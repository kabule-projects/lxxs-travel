const fs = require('fs');
const path = require('path');

const SEED_PATH = path.join(__dirname, '../cloud/seed/trip-catalog.json');

const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));

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

/** 明信片：缩略图（日记格子）与主图（点开大图）成对配置 */
const postcardImageMap = {
  pc_park_duck: { full: 'postcards/letter-1', thumb: 'postcards/letter-1-thumb' },
  pc_park_slide: { full: 'postcards/letter-2', thumb: 'postcards/letter-2-thumb' },
  pc_lake_mist: { full: 'postcards/letter-3', thumb: 'postcards/letter-3-thumb' },
  pc_lake_sr: { full: 'postcards/letter-4', thumb: 'postcards/letter-4-thumb' },
  pc_town_lantern: { full: 'postcards/letter-5', thumb: 'postcards/letter-5-thumb' },
  pc_hill_wind: { full: 'postcards/letter-6', thumb: 'postcards/letter-6-thumb' },
  pc_coast_ssr: { full: 'postcards/letter-7', thumb: 'postcards/letter-7-thumb' },
  pc_anywhere_star: { full: 'postcards/letter-8', thumb: 'postcards/letter-8-thumb' },
  pc_nature_leaf: { full: 'postcards/letter-9', thumb: 'postcards/letter-9-thumb' },
};

seed.postcards.forEach((pc) => {
  const pair = postcardImageMap[pc.id];
  if (pair) {
    pc.imageFull = pair.full;
    pc.imageThumb = pair.thumb;
  }
  if (!pc.type) {
    pc.type = 'letter';
  }
});

fs.writeFileSync(SEED_PATH, JSON.stringify(seed, null, 2) + '\n');

console.log('seed icons updated');
console.log('items updated:', Object.keys(itemIconMap).length);
console.log('postcards updated:', Object.keys(postcardImageMap).length);
