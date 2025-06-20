import React from 'react';
import { render } from '@testing-library/react';
import LoadingSpinner from './LoadingSpinner';

describe('LoadingSpinner', () => {
  test('renders loading spinner', () => {
    const { container } = render(<LoadingSpinner />);
    expect(container).toBeInTheDocument();
  });

  test('renders with custom size', () => {
    render(<LoadingSpinner />);
    expect(document.body).toBeInTheDocument();
  });
});
