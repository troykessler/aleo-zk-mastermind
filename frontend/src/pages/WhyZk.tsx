import ExternalLinkIcon from '../components/ExternalLinkIcon'
import { Feedback } from '../components/MastermindBoard'
import { Peg } from '../components/Pegs'
import PageTitle from '../components/PageTitle'
import { useTabTitle } from '../useTabTitle'

export default function WhyZk() {
  useTabTitle('Why ZK?')
  return <article className="why-page">
    <div className="why-intro">
      <PageTitle punctuation="?">Why zero knowledge</PageTitle>
      <p className="why-lead">You may be wondering how zero-knowledge proofs fit into all this.</p>
    </div>

    <section className="why-turn">
      <div className="why-story">
        <h2>How do you know the codemaker is telling the truth?</h2>
        <p>The four hidden pegs are the secret code. Since you can’t see them, the codemaker could lie about how much of your guess is correct, and you wouldn’t know. So how do we solve this?</p>
        <p>What if the codemaker could prove that, for the secret code they picked at the start, your guess has a certain number of exact and partial matches? Could they do that without revealing any of the hidden pegs?</p>
        <p className="why-answer">That’s exactly what zero-knowledge proofs let us do.</p>
      </div>
      <figure className="why-board" aria-label="Example turn from the codebreaker’s side">
        <div className="why-secret">
          <div className="private-code-label"><span className="lock-icon" aria-hidden="true" />Secret code</div>
          <div className="why-hidden" role="img" aria-label="Four hidden pegs"><i /><i /><i /><i /></div>
        </div>
        <div className="why-round">
          <div className="track-labels tray-label"><span>Your guess</span><span>Feedback</span></div>
          <div className="why-scored-row">
            <div className="guess-slots"><Peg color={0} /><Peg color={1} /><Peg color={2} /><Peg color={3} /></div>
            <Feedback guessed pegs={[1, 1]} />
          </div>
        </div>
        <figcaption className="feedback-legend"><span><i className="exact" />1 exact match</span><span><i className="partial" />1 color only</span></figcaption>
      </figure>
      <div className="why-result">
        <h2>Here’s what happens in this game</h2>
        <ol>
          <li>You submit your guess. The codemaker responds with the number of exact and partial matches, along with a zkSNARK proof that the count is correct.</li>
          <li><a className="explorer-link" href="https://aleo.org/" target="_blank" rel="noopener noreferrer"
            aria-label="Aleo (opens in a new tab)">Aleo <ExternalLinkIcon /></a> verifies that proof before the game records the feedback on-chain. You can trust the response and keep guessing.</li>
        </ol>
      </div>
    </section>
  </article>
}
