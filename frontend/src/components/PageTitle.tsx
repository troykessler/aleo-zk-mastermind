export default function PageTitle({ children, punctuation = '.' }: {
  children: string; punctuation?: '.' | '?'
}) {
  return <h1>{children}<span className="title-punctuation" aria-hidden={punctuation === '.'}>{punctuation}</span></h1>
}
