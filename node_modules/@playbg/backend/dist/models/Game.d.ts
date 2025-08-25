import mongoose, { Document } from 'mongoose';
import { Game, GameMove, ChatMessage } from '@playbg/shared';
export interface IGameDocument extends Document, Omit<Game, 'id'> {
    _id: mongoose.Types.ObjectId;
    addMove(move: GameMove): Promise<IGameDocument>;
    addChatMessage(message: ChatMessage): Promise<IGameDocument>;
    addSpectator(userId: string): Promise<IGameDocument>;
    removeSpectator(userId: string): Promise<IGameDocument>;
    isPlayerInGame(userId: string): boolean;
    getPlayerIndex(userId: string): number | null;
}
export declare const GameModel: mongoose.Model<IGameDocument, {}, {}, {}, mongoose.Document<unknown, {}, IGameDocument, {}, {}> & IGameDocument & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Game.d.ts.map