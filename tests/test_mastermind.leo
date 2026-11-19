import mastermind.aleo;
program test_mastermind.aleo {
    @test
    fn test_player_indexes() -> Final {
        let breaker = aleo1s3ws5tra87fjycnjrwsjcrnw2qxr8jfqqdugnf0xzqqw29q9m5pqem2u4t;
        let (solution, created) = mastermind.aleo::codemaker_create_game(breaker, 0u64, [1u8; 4]);
        let maker = solution.owner;
        return final {
            created.run();
            let players = [maker, breaker];
            for i in 0u8..2u8 {
                let player = players[i];
                assert_eq(mastermind.aleo::active_count.get(player), 1u64);
                let key = mastermind.aleo::PlayerSlot { player, slot: 0u64 };
                assert_eq(mastermind.aleo::active_game.get(key), 0u64);
                let reverse = mastermind.aleo::PlayerGame { player, game_id: 0u64 };
                assert_eq(mastermind.aleo::active_slot.get(reverse), 0u64);
            }
        };
    }

    @noupgrade
    constructor() {}
}
