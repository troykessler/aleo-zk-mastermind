const TURNS: u8 = 10;

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

program mastermind.aleo {
    storage game_counter: u64;

    mapping games: u64 => Game;
    mapping guesses: RoundKey => [u8; 4];
    mapping pegs: RoundKey => [u8; 2]; // white/red

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
            assert(code[i] < 8);
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

                game_counter = game_id + 1;
            }
        );
    }

    fn codebreaker_guess(public game_id: u64, public guess: [u8; 4]) -> Final {
        let codebreaker: address = std::ctx::caller();

        return final {
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
            },
        );
    }
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
