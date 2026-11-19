const TURNS: u8 = 10;
const COLORS: u8 = 6;

struct Game {
    codemaker: address,
    codebreaker: address,

    round: u8,

    completed: bool,
    solution: [u8; 4],
}

struct RoundKey {
    game_id: u64,
    round: u8,
}

export struct PlayerSlot {
    player: address,
    slot: u64,
}

export struct PlayerGame {
    player: address,
    game_id: u64,
}

program mastermind.aleo {
    storage game_counter: u64;

    mapping games: u64 => Game;
    mapping guesses: RoundKey => [u8; 4];
    mapping pegs: RoundKey => [u8; 2]; // white/red
    mapping active_count: address => u64;
    mapping active_game: PlayerSlot => u64;
    mapping active_slot: PlayerGame => u64;

    record Solution {
        owner: address,
        game_id: u64,
        code: [u8; 4],
    }

    @noupgrade
    constructor() {}

    fn codemaker_create_game(public codebreaker: address, unverified_game_id: u64, code: [u8; 4]) -> (Solution, Final) {
        let codemaker: address = std::ctx::caller();

        for i: u8 in 0u8..4u8 {
            assert(code[i] < COLORS);
        }

        let solution = Solution {
            owner: codemaker,
            game_id: unverified_game_id,
            code,
        };

        return (
            solution,
            final {
                let game_id: u64 = game_counter.unwrap_or(0u64);
                assert_eq(unverified_game_id, game_id);

                assert_neq(codemaker, codebreaker);

                games.set(game_id, Game {
                    codemaker,
                    codebreaker,
                    round: 0u8,
                    completed: false,
                    solution: [0u8; 4],
                });

                add_active_game(codemaker, game_id);
                add_active_game(codebreaker, game_id);
                game_counter = game_id + 1;
            }
        );
    }

    fn codebreaker_guess(public game_id: u64, public guess: [u8; 4]) -> Final {
        let codebreaker: address = std::ctx::caller();

        return final {
            for i: u8 in 0u8..4u8 {
                assert(guess[i] < COLORS);
            }

            assert(games.contains(game_id));

            let game = games.get(game_id);

            assert_eq(game.codebreaker, codebreaker);
            assert(!game.completed);

            let roundKey = RoundKey {
                game_id,
                round: game.round,
            };

            assert(!guesses.contains(roundKey));

            guesses.set(roundKey, guess);
            games.set(game_id, game);
        };
    }

    fn codemaker_feedback(
        public game_id: u64,
        public unverified_game: Game,
        public unverified_guess: [u8; 4],
        solution: Solution
    ) -> (Solution, Final) {
        let codemaker: address = std::ctx::caller();
        
        assert_eq(game_id, solution.game_id);

        let feedback_pegs = calculate_feedback_pegs(unverified_guess, solution.code);

        let game_completed = unverified_game.round + 1 == TURNS || feedback_pegs[1] == 4;
        let game_solution = game_completed ? solution.code : unverified_game.solution;

        return (
            solution,
            final {
                assert(games.contains(game_id));

                let game = games.get(game_id);

                assert_eq(game, unverified_game);
                assert_eq(game.codemaker, codemaker);
                assert(!game.completed);

                let roundKey = RoundKey {
                    game_id,
                    round: game.round,
                };

                assert(guesses.contains(roundKey));
                assert_eq(guesses.get(roundKey), unverified_guess);

                assert(!pegs.contains(roundKey));

                pegs.set(roundKey, feedback_pegs);

                game.round = game.round + 1;
                game.completed = game_completed;
                game.solution = game_solution;

                games.set(game_id, game);
                if game_completed {
                    remove_active_game(game.codemaker, game_id);
                    remove_active_game(game.codebreaker, game_id);
                }
            },
        );
    }
}

final fn add_active_game(player: address, game_id: u64) {
    let slot = active_count.get_or_use(player, 0u64);

    active_game.set(PlayerSlot { player, slot }, game_id);
    active_slot.set(PlayerGame { player, game_id }, slot);
    active_count.set(player, slot + 1u64);
}

final fn remove_active_game(player: address, game_id: u64) {
    let game_key = PlayerGame { player, game_id };
    let slot = active_slot.get(game_key);
    let last_slot = active_count.get(player) - 1u64;
    let last_key = PlayerSlot { player, slot: last_slot };

    if slot != last_slot {
        let moved_id = active_game.get(last_key);
        
        active_game.set(PlayerSlot { player, slot }, moved_id);
        active_slot.set(PlayerGame { player, game_id: moved_id }, slot);
    }

    active_game.remove(last_key);
    active_slot.remove(game_key);
    active_count.set(player, last_slot);
}

fn calculate_feedback_pegs(guess: [u8; 4], solution: [u8; 4]) -> [u8; 2] {
    let red = 0u8;

    for i in 0u8..4u8 {
        if guess[i] == solution[i] {
            red += 1;
        }
    }

    let color_matches = 0u8;

    for color in 0u8..8u8 {
        let in_guess = 0u8;
        let in_solution = 0u8;

        for i in 0u8..4u8 {
            if color == guess[i] {
                in_guess += 1;
            }

            if color == solution[i] {
                in_solution += 1;
            }
        }

        color_matches += in_guess < in_solution ? in_guess : in_solution;
    }

    let white = color_matches - red;
    return [white, red];
}
