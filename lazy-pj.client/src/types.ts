export const RequestStatus = {
    Pending: 0,
    Approve: 1,
    Denied: 2,
} as const;

export type RequestStatusCode = (typeof RequestStatus)[keyof typeof RequestStatus];

export interface UserModel {
    id: number;
    email: string;
    name: string;
    password?: string;
}

export interface AdminModel {
    id: number;
    email: string;
    name: string;
    password?: string;
}

export interface AdminRequestModel {
    id: number;
    userId: number;
    userEmail: string;
    description: string;
    creationTime: string;
    approved: RequestStatusCode;
}

export interface CreateRequestDTO {
    userId: number;
    description: string;
}

export interface AuthUser {
    id: number;
    email: string;
    name: string;
    role: 'User' | 'Admin';
    password?: string;
}

export interface AuthSession {
    token: string;
    user: AuthUser;
}
