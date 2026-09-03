export type ItemType =
  | 'food'
  | 'accessory'
  | 'equipment'
  | 'souvenir'
  | 'rice_star';

export type PostcardRarity = 'N' | 'R' | 'SR' | 'SSR' | 'UR';

/** 明信片类型：控制日记/信箱展示形态，后续可扩展 */
export type PostcardType = 'postcard' | 'letter' | 'photo' | 'special';

export type TripStatus = 'preparing' | 'traveling' | 'returned' | 'at_home';

export type PostcardDeliveryStatus = 'pending' | 'delivered' | 'claimed';

export type ShopTab = 'all' | 'food' | 'accessory' | 'equipment';

export interface BiasEntry {
  groupId?: string;
  tag?: string;
  weight?: number;
  weightMul?: number;
}

export interface ItemDefinition {
  id: string;
  type: ItemType;
  name: string;
  icon: string;
  description: string;
  price?: number;
  durationMinH?: number;
  durationMaxH?: number;
  distanceMin?: number;
  distanceMax?: number;
  /** 明信片 groupId 权重乘数 */
  postcardBias?: Array<{ groupId: string; weight: number }>;
  /** 目的地 terrainTags 乘数 */
  terrainBias?: Array<{ tag: string; weightMul: number }>;
  /** 第二张明信片概率加成（可负） */
  secondPostcardRateBonus?: number;
  /** 携带时目的地总分乘数 */
  destWeightMul?: number;
  shopCategory?: Exclude<ShopTab, 'all'>;
  shopSort?: number;
  dailyLimit?: 1;
  enabled: boolean;
}

export interface DestinationDefinition {
  id: string;
  name: string;
  terrainTags: string[];
  distanceTier: number;
  baseWeight: number;
  durationMinH: number;
  durationMaxH: number;
  souvenirPool: string[];
  enabled: boolean;
}

export interface PostcardImages {
  /** 日记格子 / 信箱列表用缩略切图 */
  imageThumb: string;
  /** 点开放大 / 信件主图 */
  imageFull: string;
}

export interface PostcardDefinition {
  id: string;
  title: string;
  type: PostcardType;
  rarity: PostcardRarity;
  groupId: string;
  destId?: string;
  imageThumb: string;
  imageFull: string;
  story: string;
  baseWeight: number;
  enabled: boolean;
}

/** game_config.key = trip */
export interface TripGameConfig {
  key: 'trip';
  distanceMatchMul: number;
  distanceMissMul: number;
  riceDestMul: number;
  ricePostcardMul: number;
  riceRarityMul: Partial<Record<PostcardRarity, number>>;
  secondPostcardRate: number;
  riceSecondPostcardBonus: number;
  deliverAtMinRatio: number;
  deliverAtMaxRatio: number;
  destMatchMul: number;
}

export interface TripPostcardInstance {
  instanceId: string;
  postcardId: string;
  type: PostcardType;
  status: PostcardDeliveryStatus;
  deliverAt: number;
  title: string;
  rarity: PostcardRarity;
  groupId: string;
  imageThumb: string;
  imageFull: string;
  story: string;
  claimedAt?: number;
}

export interface Loadout {
  /** 美食，必填才能出发 */
  bento: string;
  /** 是否携带米字星（可选，影响稀有事件） */
  riceStar?: boolean;
  /** 道具最多 2 个（饰品/装备），可选 */
  props?: string[];
}

export interface UserDoc {
  userId: string;
  openid: string;
  nickName?: string;
  avatarUrl?: string;
  profileAuthorized?: boolean;
  stars: number;
  riceStars: number;
  gm: boolean;
  pitySR: number;
  pitySSR: number;
  pityUR: number;
  currentTripId?: string;
  lastSpawnAt: number;
  nextSpawnAt: number;
  createdAt: number;
  lastLoginAt: number;
}

export interface TripDoc {
  _id: string;
  userId: string;
  status: TripStatus;
  loadout: Loadout;
  destId: string;
  destName?: string;
  startAt: number;
  endAt: number;
  durationH?: number;
  postcards: TripPostcardInstance[];
  postcardIds: string[];
  postcardStatus: PostcardDeliveryStatus[];
  souvenirs: string[];
  usedRiceStar: boolean;
  secondPostcardRate?: number;
}

export type RoofStarStatus = 'pending' | 'dropped' | 'collected';

export interface RoofStarDoc {
  id: string;
  userId: string;
  type: 'normal' | 'rice';
  status: RoofStarStatus;
  /** 空中位置（百分比） */
  skyX: number;
  skyY: number;
  /** 地上堆叠位置（百分比） */
  x: number;
  y: number;
  rotate: number;
  spawnAt: number;
  dropAt: number;
  collectedAt?: number;
}

export type CopyPoolType = 'depart_farewell' | 'shop_talk';

export interface CopyPoolDoc {
  type: CopyPoolType;
  text: string;
  enabled: boolean;
}

/** CDN / 云存储资源 manifest 条目 */
export interface AssetManifestEntry {
  path: string;
  hash: string;
  w: number;
  h: number;
  dpr: number[];
  fileID?: string;
  createdAt?: number;
  updatedAt?: number;
}
