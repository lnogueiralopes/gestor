-- Seven independent bands: 1, 2, 3, 4, 5, 6, and all quantities above 6.
begin;
create temporary table previous_kit_margin_rules on commit drop as
select * from public.kit_margin_rules;

alter table public.kit_margin_rules alter column max_units drop not null;
alter table public.kit_margin_rules alter column reduction_pp type numeric(8,2);
delete from public.kit_margin_rules;

insert into public.kit_margin_rules(min_units,max_units,reduction_pp)
select quantity, case when quantity = 7 then null else quantity end,
  coalesce((
    select reduction_pp from previous_kit_margin_rules
    where min_units <= quantity
    -- Prefer a containing rule, then the closest preceding rule for a new band.
    order by (max_units is null or max_units >= quantity) desc, min_units desc, id
    limit 1
  ),0)
from generate_series(1,7) quantity;

alter table public.kit_margin_rules add constraint kit_margin_canonical_band check (
  (min_units between 1 and 6 and max_units is not null and max_units = min_units)
  or (min_units = 7 and max_units is null)
);
alter table public.kit_margin_rules add constraint kit_margin_nonnegative check (reduction_pp >= 0);
create unique index kit_margin_one_rule_per_band on public.kit_margin_rules(min_units);
comment on column public.kit_margin_rules.max_units is 'NULL means unlimited: min_units=7 represents >6.';
commit;
