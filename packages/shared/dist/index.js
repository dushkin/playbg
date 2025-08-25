"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_RATING = exports.MIN_RATING = exports.INITIAL_RATING = exports.INITIAL_BOARD_STATE = exports.AchievementCategory = exports.MatchStatus = exports.RoundStatus = exports.ParticipantStatus = exports.TournamentStatus = exports.TournamentFormat = exports.TournamentType = exports.GameResult = exports.GameSpeed = exports.GameType = exports.GameState = void 0;
// Enums
var GameState;
(function (GameState) {
    GameState["WAITING"] = "waiting";
    GameState["IN_PROGRESS"] = "in_progress";
    GameState["FINISHED"] = "finished";
    GameState["PAUSED"] = "paused";
    GameState["ABANDONED"] = "abandoned";
})(GameState || (exports.GameState = GameState = {}));
var GameType;
(function (GameType) {
    GameType["CASUAL"] = "casual";
    GameType["RANKED"] = "ranked";
    GameType["TOURNAMENT"] = "tournament";
    GameType["PRIVATE"] = "private";
})(GameType || (exports.GameType = GameType = {}));
var GameSpeed;
(function (GameSpeed) {
    GameSpeed["BLITZ"] = "blitz";
    GameSpeed["RAPID"] = "rapid";
    GameSpeed["STANDARD"] = "standard";
    GameSpeed["UNLIMITED"] = "unlimited";
})(GameSpeed || (exports.GameSpeed = GameSpeed = {}));
var GameResult;
(function (GameResult) {
    GameResult["WIN"] = "win";
    GameResult["LOSS"] = "loss";
    GameResult["DRAW"] = "draw";
    GameResult["ABANDONED"] = "abandoned";
})(GameResult || (exports.GameResult = GameResult = {}));
var TournamentType;
(function (TournamentType) {
    TournamentType["SINGLE_ELIMINATION"] = "single_elimination";
    TournamentType["DOUBLE_ELIMINATION"] = "double_elimination";
    TournamentType["ROUND_ROBIN"] = "round_robin";
    TournamentType["SWISS"] = "swiss";
})(TournamentType || (exports.TournamentType = TournamentType = {}));
var TournamentFormat;
(function (TournamentFormat) {
    TournamentFormat["MATCH_PLAY"] = "match_play";
    TournamentFormat["MONEY_GAME"] = "money_game";
})(TournamentFormat || (exports.TournamentFormat = TournamentFormat = {}));
var TournamentStatus;
(function (TournamentStatus) {
    TournamentStatus["REGISTRATION"] = "registration";
    TournamentStatus["IN_PROGRESS"] = "in_progress";
    TournamentStatus["FINISHED"] = "finished";
    TournamentStatus["CANCELLED"] = "cancelled";
})(TournamentStatus || (exports.TournamentStatus = TournamentStatus = {}));
var ParticipantStatus;
(function (ParticipantStatus) {
    ParticipantStatus["REGISTERED"] = "registered";
    ParticipantStatus["ACTIVE"] = "active";
    ParticipantStatus["ELIMINATED"] = "eliminated";
    ParticipantStatus["WITHDRAWN"] = "withdrawn";
})(ParticipantStatus || (exports.ParticipantStatus = ParticipantStatus = {}));
var RoundStatus;
(function (RoundStatus) {
    RoundStatus["PENDING"] = "pending";
    RoundStatus["IN_PROGRESS"] = "in_progress";
    RoundStatus["COMPLETED"] = "completed";
})(RoundStatus || (exports.RoundStatus = RoundStatus = {}));
var MatchStatus;
(function (MatchStatus) {
    MatchStatus["SCHEDULED"] = "scheduled";
    MatchStatus["IN_PROGRESS"] = "in_progress";
    MatchStatus["COMPLETED"] = "completed";
    MatchStatus["WALKOVER"] = "walkover";
})(MatchStatus || (exports.MatchStatus = MatchStatus = {}));
var AchievementCategory;
(function (AchievementCategory) {
    AchievementCategory["GAMES"] = "games";
    AchievementCategory["WINS"] = "wins";
    AchievementCategory["RATING"] = "rating";
    AchievementCategory["TOURNAMENTS"] = "tournaments";
    AchievementCategory["SOCIAL"] = "social";
    AchievementCategory["SPECIAL"] = "special";
})(AchievementCategory || (exports.AchievementCategory = AchievementCategory = {}));
// Game Logic Constants
exports.INITIAL_BOARD_STATE = {
    points: [
        [0, 2], [0, 0], [0, 0], [0, 0], [0, 0], [1, 5], // Points 1-6
        [0, 0], [1, 3], [0, 0], [0, 0], [0, 0], [0, 5], // Points 7-12
        [1, 5], [0, 0], [0, 0], [0, 0], [0, 3], [0, 0], // Points 13-18
        [0, 5], [0, 0], [0, 0], [0, 0], [0, 0], [0, 2] // Points 19-24
    ],
    bar: [0, 0],
    off: [0, 0]
};
exports.INITIAL_RATING = 1200;
exports.MIN_RATING = 100;
exports.MAX_RATING = 3000;
//# sourceMappingURL=index.js.map