import mongoose, { Document } from 'mongoose';
import { GameSpeed } from '@playbg/shared';
export interface IUserDocument extends Document {
    username: string;
    email: string;
    password: string;
    avatar?: string;
    rating: number;
    gamesPlayed: number;
    gamesWon: number;
    isOnline: boolean;
    lastSeen: Date;
    bio?: string;
    country?: string;
    preferredGameSpeed: GameSpeed;
    createdAt: Date;
    updatedAt: Date;
    comparePassword(candidatePassword: string): Promise<boolean>;
    generateAuthToken(): string;
}
export declare const User: mongoose.Model<IUserDocument, {}, {}, {}, mongoose.Document<unknown, {}, IUserDocument, {}, {}> & IUserDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=User.d.ts.map