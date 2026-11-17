// The 'test_mastermind' test program.
import mastermind.aleo;
program test_mastermind.aleo {
    @test
    @should_fail
    fn test_main_fails() {
        let result: u32 = mastermind.aleo::main(2u32, 3u32);
        assert_eq(result, 3u32);
    }

    @noupgrade
    constructor() {}
}
