alter table user_awaiting_confirmation add column pending_country_id uuid references country(id);
alter table user_awaiting_confirmation add column pending_region_id uuid references region(id);