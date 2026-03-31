create table user_change_history (
    id uuid primary key,
    actor_user_id uuid references platform_user(id),
    target_user_id uuid not null references platform_user(id),

    event_type varchar(50) not null,

    platform_user_employee_role_id uuid references platform_user_employee_role(id),
    employee_role_id uuid references employee_role(id),

    status_before varchar(50),
    status_after varchar(50),
    active_before boolean,
    active_after boolean,

    reason text,

    created_at timestamp not null,
    updated_at timestamp not null
);

create index idx_user_change_history_target_user_id_created_at
    on user_change_history (target_user_id, created_at);

