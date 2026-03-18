import React from 'react'
import { render } from '@testing-library/react'
import { ChartTouchWrapper } from '../ChartTouchWrapper'

/**
 * Regression test: ChartTouchWrapper must set width: 100% on its root div.
 *
 * When ChartTouchWrapper is rendered inside a flex container (as it is in
 * page.tsx), `ResponsiveContainer width="100%"` inside it resolves against
 * ChartTouchWrapper's width. Without width: 100%, ChartTouchWrapper shrinks
 * to zero width and makes the charts invisible.
 */
describe('ChartTouchWrapper', () => {
  it('renders a full-width root element so ResponsiveContainer can fill it', () => {
    const { container } = render(
      <ChartTouchWrapper>
        <div data-testid="child">chart</div>
      </ChartTouchWrapper>
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveStyle({ width: '100%' })
  })

  it('renders children', () => {
    const { getByTestId } = render(
      <ChartTouchWrapper>
        <div data-testid="child">chart</div>
      </ChartTouchWrapper>
    )
    expect(getByTestId('child')).toBeInTheDocument()
  })
})
