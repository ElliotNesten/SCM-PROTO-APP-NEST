create table user_awaiting_confirmation (
    id uuid primary key,
    user_id uuid not null references platform_user(id),
    confirmation_token_hash varchar(255) not null,
    pending_first_name varchar(100) not null,
    pending_last_name varchar(100) not null,
    pending_phone_number varchar(20) not null,
    pending_password_hash varchar(255) not null,
    created_at timestamp not null,
    expires_at timestamp not null
);

create index if not exists idx_user_awaiting_confirmation_token_hash
    on user_awaiting_confirmation (confirmation_token_hash);