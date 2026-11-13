export interface BodyDto {
    mass: number;
    positionX: number;
    positionY: number;
    velocityX: number;
    velocityY: number;
}

export interface PresetListItem {
    id: number;
    title: string;
    description: string | null;
    outcome: string | null;
    previewUrl: string | null;
    authorName: string;
    createdAt: string;
    canEdit: boolean;
}

export interface PresetDetail {
    id: number;
    title: string;
    description: string | null;
    bodies: BodyDto[];
    g: number;
    softening: number;
    dt: number;
    outcome: string | null;
    authorName: string;
    authorId: number;
    canEdit: boolean;
}

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
