import { useEffect } from 'react'

export function useTabTitle(status?: string) {
  useEffect(() => {
    const base = 'Aleo Mastermind'
    document.title = status ? status + ' · ' + base : base
    return () => { document.title = base }
  }, [status])
}
