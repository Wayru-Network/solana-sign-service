
export interface User {
    id: number;
    username: string;
    email: string;
    provider: string;
    password: string;
    reset_password_token: string | null;
    confirmation_token: string | null;
    confirmed: boolean;
    blocked: boolean;
    created_at: Date;
    updated_at: Date;
    created_by_id: number | null;
    updated_by_id: number;
    city: string;
    country: string;
    bio: string | null;
    show_social: boolean | null;
    twitter: string | null;
    linkedin: string | null;
    node_operator: boolean;
    refered: string | null;
    first_name: string;
    last_name: string;
    phone: string;
    source: string | null;
    wispro_billing_id: string | null;
    user_roles: string | null;
    accepts_wru: boolean;
    wayru_points: number | null;
    pin_code: string | null;
    pool_tokens: number | null;
    sender_algo_used_times: number | null;
    recharge_times: number;
    socket_id: string;
    online: boolean;
    reward_tasks: string | null,
    reward_amount_claimed: number,
    reward_amount_unclaimed: number,
    validate_refered_user: string | null,
    task_completed_date: string | null,
    gender: string,
    birthdate: string,
    website: string | null,
    dynamic_link: string | null,
    location: { latitude: number, longitude: number },
    verified: boolean | null,
    quota_migrated: boolean,
    wallet: boolean,
    nickname: string | null
  }