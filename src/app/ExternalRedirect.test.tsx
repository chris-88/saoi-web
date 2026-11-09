import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import {
  AdminRedirect,
  ArticleRedirect,
  HowItWorksRedirect,
  ShowcaseRedirect,
} from '@/app/ExternalRedirect'

const replace = vi.fn()
const original = window.location

beforeEach(() => {
  replace.mockClear()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...original, replace },
  })
})

afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: original })
})

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/showcase" element={<ShowcaseRedirect />} />
        <Route path="/article" element={<ArticleRedirect />} />
        <Route path="/how-it-works" element={<HowItWorksRedirect />} />
        <Route path="/how-it-works/:section" element={<HowItWorksRedirect />} />
        <Route path="/admin/*" element={<AdminRedirect />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('redirects to the showcase site', () => {
  it('/showcase goes to the showcase home', () => {
    renderAt('/showcase')
    expect(replace).toHaveBeenCalledExactlyOnceWith('https://showcase.saoi.ie/#/')
  })

  it('/article goes to the article', () => {
    renderAt('/article')
    expect(replace).toHaveBeenCalledExactlyOnceWith('https://showcase.saoi.ie/#/article')
  })

  it('/how-it-works goes to the explainer', () => {
    renderAt('/how-it-works')
    expect(replace).toHaveBeenCalledExactlyOnceWith('https://showcase.saoi.ie/#/how-it-works')
  })

  it('/how-it-works/:section keeps the section', () => {
    renderAt('/how-it-works/story')
    expect(replace).toHaveBeenCalledExactlyOnceWith('https://showcase.saoi.ie/#/how-it-works/story')
  })
})

describe('redirects to the console site', () => {
  it('/admin goes to the console home', () => {
    renderAt('/admin')
    expect(replace).toHaveBeenCalledExactlyOnceWith('https://admin.saoi.ie/#/')
  })

  it('/admin/case/:id keeps the rest of the path', () => {
    renderAt('/admin/case/abc')
    expect(replace).toHaveBeenCalledExactlyOnceWith('https://admin.saoi.ie/#/case/abc')
  })
})
