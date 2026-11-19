import { Feedback } from '../components/MastermindBoard'
import { Peg } from '../components/Pegs'
import { useTabTitle } from '../useTabTitle'

export default function GameRules() {
  useTabTitle('Rules')
  return <article className="rules-page">
    <h1>How to play Mastermind</h1>
    <p>The codemaker hides four colored pegs. The codebreaker has ten guesses to find the colors in the right order.</p>

    <div className="rules-layout">
      <section className="panel">
        <h2>Set the code</h2>
        <p>As codemaker, fill all four sockets using any of the six colors. You can repeat a color, even in all four sockets. Enter the codebreaker’s Aleo address, create the game with Shield, and share the game link.</p>
        <h2>Play a turn</h2>
        <p>As codebreaker, open the board, choose four colors in order, and submit your guess with Shield.</p>
        <p>The codemaker then selects <strong>Give feedback with Shield</strong>. The contract checks the guess against the private code and places the clues beside that row. Use the clues from all previous rows to narrow down your next guess.</p>
        <h2>Win the game</h2>
        <p>Four exact matches win the game for the codebreaker, even on the tenth guess. If the tenth guess falls short, the codemaker wins. The board reveals the secret when the game ends.</p>
        <p>For a tabletop-style match, swap roles each game and keep score yourselves. Each codemaker earns one point per guess their opponent uses. After equal turns as codemaker, the higher score wins.</p>
      </section>

      <section className="panel">
        <h2>Read the clues</h2>
        <ul className="rules-key">
          <li><i className="exact" aria-hidden="true" /><span><strong>Coral · Exact match</strong><br />One peg has the right color in the right socket.</span></li>
          <li><i className="partial" aria-hidden="true" /><span><strong>Ivory · Color only</strong><br />One more peg has a color the code needs, but belongs in a different socket.</span></li>
        </ul>
        <p>Clues describe the whole row. Their order gives away no positions. Count exact matches first. Each peg in the secret can earn just one clue.</p>
        <figure className="rules-example">
          <div><span>Secret</span><span className="rules-pegs"><Peg color={3}/><Peg color={2}/><Peg color={1}/><Peg color={5}/></span></div>
          <div><span>Guess</span><span className="rules-pegs"><Peg color={3}/><Peg color={3}/><Peg color={2}/><Peg color={4}/></span></div>
          <div><span>Clues</span><Feedback guessed pegs={[1, 1]} /></div>
          <figcaption>The first blue earns a coral clue. There’s only one blue in the secret, so the second blue earns nothing. Mint earns an ivory clue because it belongs one socket to the left. Violet is absent.</figcaption>
        </figure>
        <p>A scored row marked × means zero matches. You can rule out every color in that guess.</p>
      </section>
    </div>
  </article>
}
