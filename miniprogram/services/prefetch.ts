import { call } from './api';
import { prefetchShowcase, seedShowcaseFromBatch } from './showcase';
import { prefetchShop, seedShopFromBatch } from './shop';
import { prefetchGachaCatalog, seedGachaFromBatch } from './gacha';

/**
 * loading 阶段三池预取合一：一次 showcase.batchGet 拿回 展示柜+商店+扭蛋图鉴 三段，
 * 分别写入各服务会话缓存（结构同各自 list 接口，后端单段失败置 null）。
 * 段为 null 或写入失败时回落旧的单接口预取，行为与旧三连完全一致。
 */
export async function prefetchAllPools(): Promise<void> {
  interface BatchSections {
    showcase?: unknown;
    shop?: unknown;
    gacha?: unknown;
  }
  let sections: BatchSections | null = null;
  try {
    sections = await call<BatchSections>('showcase', { action: 'batchGet' });
  } catch {
    sections = null;
  }
  if (!sections) {
    // batchGet 整体不可用（网络/旧云函数）：回落旧三连
    void prefetchShowcase();
    void prefetchShop();
    void prefetchGachaCatalog();
    return;
  }
  // 每段独立 seed，失败各自回落单拉，互不影响
  void (async () => {
    if (sections!.showcase == null || !(await seedShowcaseFromBatch(sections!.showcase))) {
      await prefetchShowcase();
    }
  })();
  void (async () => {
    if (sections!.shop == null || !(await seedShopFromBatch(sections!.shop))) {
      await prefetchShop();
    }
  })();
  void (async () => {
    if (sections!.gacha == null || !(await seedGachaFromBatch(sections!.gacha))) {
      await prefetchGachaCatalog();
    }
  })();
}
