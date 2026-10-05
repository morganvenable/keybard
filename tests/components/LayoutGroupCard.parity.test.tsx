import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LayoutGroupCard } from '@/components/LayoutGroupCard';
import type { LayoutGroup } from '@/types/layer-library';

vi.mock('@/components/LayerRow', () => ({ default: ({ layer }: any) => <div>Preview {layer.name}</div> }));
const group: LayoutGroup = { id: 'imported', name: 'My layout', source: 'imported', layers: [{ index: 0, name: 'Alpha', keymap: [] }, { index: 1, name: 'Numbers', keymap: [] }] };
describe.each([false, true])('Layout group compact=%s', compact => {
  it('keeps the same collapsible group and delete confirmation', () => {
    const remove = vi.fn();
    render(<LayoutGroupCard group={group} compact={compact} defaultExpanded onDelete={remove} />);
    expect(screen.getByText('Preview Numbers')).toBeInTheDocument();
    fireEvent.click(screen.getByText('My layout'));
    expect(screen.queryByText('Preview Numbers')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('My layout'));
    fireEvent.click(screen.getByTitle('Delete layout'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Preview Numbers')).toBeInTheDocument();
  });
});
