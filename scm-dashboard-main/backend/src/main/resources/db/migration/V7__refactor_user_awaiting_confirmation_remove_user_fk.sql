alter table user_awaiting_confirmation
    add column pending_email varchar(255);

update user_awaiting_confirmation uac
set pending_email = pu.email
from platform_user pu
where pu.id = uac.user_id;

alter table user_awaiting_confirmation
    alter column pending_email set not null;

alter table user_awaiting_confirmation
    drop column user_id cascade;

create index if not exists idx_user_awaiting_confirmation_pending_email
    on user_awaiting_confirmation (pending_email);

create index if not exists idx_user_awaiting_confirmation_expires_at
    on user_awaiting_confirmation (expires_at);

