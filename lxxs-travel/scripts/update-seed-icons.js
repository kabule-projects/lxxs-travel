const fs = require('fs');
const path = require('path');

const SEED_PATH = path.join(__dirname, '../cloud/seed/trip-catalog.json');

const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));

// 更新 items 的 icon（保持 id/name 不变，只换图片路径）
const itemIconMap = {
  food_bento_a: 'items/food/mifan',
  food_bento_b: 'items/food/dangao',
  food_tea: 'items/food/zhou',
  acc_scarf: 'items/accessory/hat',
  acc_hat: 'items/accessory/bear',
  acc_glasses: 'items/accessory/hat',
  eq_map: 'items/equipment/laobiao',
  eq_cam: 'items/equipment/mic',
  eq_compass: 'items/equipment/laobiao',
  souvenir_potato: 'items/souvenir/yizhuan',
  souvenir_leaf: 'items/souvenir/erzhuan',
  souvenir_badge: 'items/souvenir/biao',
  souvenir_shell: 'items/souvenir/youtiao',
  souvenir_pebble: 'items/souvenir/frame-1',
  acc_badge: 'items/souvenir/glasses',
};

seed.items.forEach((item) => {
  if (itemIconMap[item.id]) {
    item.icon = itemIconMap[item.id];
  }
});

// 更新 postcards 的 imageThumb / imageFull（没有 thumb 就用同一张）
const postcardImageMap = {
  pc_park_duck: 'postcards/letter-1',
  pc_park_slide: 'postcards/letter-2',
  pc_lake_mist: 'postcards/letter-3',
  pc_lake_sr: 'postcards/letter-4',
  pc_town_lantern: 'postcards/letter-5',
  pc_hill_wind: 'postcards/letter-6',
  pc_coast_ssr: 'postcards/letter-7',
  pc_anywhere_star: 'postcards/letter-8',
  pc_nature_leaf: 'postcards/letter-9',
};

seed.postcards.forEach((pc) => {
  if (postcardImageMap[pc.id]) {
    pc.imageThumb = postcardImageMap[pc.id];
    pc.imageFull = postcardImageMap[pc.id];
  }
});

fs.writeFileSync(SEED_PATH, JSON.stringify(seed, null, 2) + '\n');

console.log('seed icons updated');
console.log('items updated:', Object.keys(itemIconMap).length);
console.log('postcards updated:', Object.keys(postcardImageMap).length);
