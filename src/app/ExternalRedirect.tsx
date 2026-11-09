import { useEffect, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { adminUrl, showcaseUrls } from '@/app/routes'

/** Sends the browser to another site. Replaces the history entry so Back does not bounce. */
function ExternalRedirect({ to }: { readonly to: string }): ReactNode {
  useEffect(() => {
    window.location.replace(to)
  }, [to])
  return null
}

export function ShowcaseRedirect(): ReactNode {
  return <ExternalRedirect to={showcaseUrls.showcase} />
}

export function ArticleRedirect(): ReactNode {
  return <ExternalRedirect to={showcaseUrls.article} />
}

export function HowItWorksRedirect(): ReactNode {
  const { section } = useParams()
  return <ExternalRedirect to={showcaseUrls.howItWorks(section)} />
}

/** `/admin/*`: the console moved to admin.saoi.ie. The rest of the path is kept. */
export function AdminRedirect(): ReactNode {
  const { '*': rest } = useParams()
  return <ExternalRedirect to={adminUrl(rest)} />
}
