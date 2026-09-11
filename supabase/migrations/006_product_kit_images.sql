-- Six ordered image slots for catalog products and kits.
-- EAN uniqueness is already enforced by migration 003.
-- Values may be public URLs or paths in the future Supabase/Cloudflare image bucket.
alter table public.products
  add column image_1_url text,
  add column image_2_url text,
  add column image_3_url text,
  add column image_4_url text,
  add column image_5_url text,
  add column image_6_url text;

alter table public.kits
  add column image_1_url text,
  add column image_2_url text,
  add column image_3_url text,
  add column image_4_url text,
  add column image_5_url text,
  add column image_6_url text;

comment on column public.products.image_1_url is 'Imagem principal do produto; arquivos EAN_1.jpg.';
comment on column public.kits.image_1_url is 'Imagem principal do kit; arquivo EAN_xN.jpg.';

-- Apply named image paths to catalog rows already imported. Internal codes
-- and mixed kits require their own supplied images.
update public.products set
  image_1_url = '/images/' || ean || '_1.jpg',
  image_2_url = '/images/' || ean || '_2.jpg',
  image_3_url = '/images/' || ean || '_3.jpg',
  image_4_url = '/images/' || ean || '_4.jpg'
where not ean_is_internal;

update public.kits k set
  image_1_url = '/images/' || p.ean || '_x' || ki.quantity || '.jpg',
  image_2_url = p.image_1_url,
  image_3_url = p.image_2_url,
  image_4_url = p.image_3_url,
  image_5_url = p.image_4_url
from public.kit_items ki join public.products p on p.id = ki.product_id
where ki.kit_id = k.id and not p.ean_is_internal
  and ki.quantity in (2,3,4,6)
  and (select count(*) from public.kit_items other where other.kit_id=k.id)=1;

