import mongoose, { Document } from 'mongoose';
import { Tournament, TournamentParticipant } from '@playbg/shared';
export interface ITournamentDocument extends Document, Omit<Tournament, 'id'> {
    _id: mongoose.Types.ObjectId;
    addParticipant(userId: string, username: string, rating: number): Promise<ITournamentDocument>;
    removeParticipant(userId: string): Promise<ITournamentDocument>;
    isParticipant(userId: string): boolean;
    getParticipant(userId: string): TournamentParticipant | null;
    generateBracket(): Promise<ITournamentDocument>;
    advanceToNextRound(): Promise<ITournamentDocument>;
    isComplete(): boolean;
}
export declare const TournamentModel: mongoose.Model<ITournamentDocument, {}, {}, {}, mongoose.Document<unknown, {}, ITournamentDocument, {}, {}> & ITournamentDocument & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Tournament.d.ts.map