import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Aggarwal Caterers landing page and inquiry form', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /aggarwal caterers/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /submit catering inquiry/i })).toBeInTheDocument();
});
