import mastermind.aleo;

// Feedback is [right color in the wrong slot, exact match].
fn assert_score(guess: [u8; 4], solution: [u8; 4], expected: [u8; 2]) {
    assert_eq(mastermind.aleo::calculate_feedback_pegs(guess, solution), expected);
    // Swapping the two rows preserves the score, even with unequal color counts.
    assert_eq(mastermind.aleo::calculate_feedback_pegs(solution, guess), expected);
}

program test_feedback_pegs.aleo {
    @test
    fn no_exact_matches() {
        assert_score([0u8; 4], [5u8; 4], [0u8, 0u8]);
        assert_score([5u8, 5u8, 0u8, 0u8], [1u8, 2u8, 5u8, 3u8], [1u8, 0u8]);
        assert_score([0u8, 0u8, 1u8, 1u8], [1u8, 2u8, 0u8, 2u8], [2u8, 0u8]);
        assert_score([0u8, 0u8, 1u8, 2u8], [1u8, 2u8, 0u8, 3u8], [3u8, 0u8]);
        assert_score([0u8, 0u8, 5u8, 5u8], [5u8, 5u8, 0u8, 0u8], [4u8, 0u8]);
    }

    @test
    fn one_exact_match() {
        assert_score([5u8; 4], [1u8, 2u8, 3u8, 5u8], [0u8, 1u8]);
        assert_score([3u8, 3u8, 2u8, 4u8], [3u8, 2u8, 1u8, 5u8], [1u8, 1u8]);
        assert_score([1u8, 2u8, 3u8, 4u8], [1u8, 3u8, 2u8, 0u8], [2u8, 1u8]);
        assert_score([1u8, 2u8, 3u8, 4u8], [1u8, 3u8, 4u8, 2u8], [3u8, 1u8]);
    }

    @test
    fn two_exact_matches() {
        assert_score([0u8, 5u8, 0u8, 5u8], [0u8, 5u8, 1u8, 2u8], [0u8, 2u8]);
        assert_score([0u8, 1u8, 0u8, 2u8], [0u8, 1u8, 2u8, 3u8], [1u8, 2u8]);
        assert_score([0u8, 5u8, 1u8, 1u8], [5u8, 0u8, 1u8, 1u8], [2u8, 2u8]);
    }

    @test
    fn three_exact_matches() {
        assert_score([1u8; 4], [1u8, 1u8, 4u8, 1u8], [0u8, 3u8]);
    }

    @test
    fn four_exact_matches() {
        assert_score([0u8, 5u8, 5u8, 2u8], [0u8, 5u8, 5u8, 2u8], [0u8, 4u8]);
    }

    @noupgrade
    constructor() {}
}
