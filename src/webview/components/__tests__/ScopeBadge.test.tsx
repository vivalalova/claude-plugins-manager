/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScopeBadge } from '../ScopeBadge';

describe('ScopeBadge', () => {
  describe('無 projectPath 時顯示 scope 文字', () => {
    it('user scope 顯示 "user"', () => {
      render(<ScopeBadge scope="user" />);
      expect(screen.getByText('user')).toBeTruthy();
    });

    it('project scope 顯示 "project"', () => {
      render(<ScopeBadge scope="project" />);
      expect(screen.getByText('project')).toBeTruthy();
    });

    it('local scope 顯示 "local"', () => {
      render(<ScopeBadge scope="local" />);
      expect(screen.getByText('local')).toBeTruthy();
    });
  });

  describe('CSS class 依 scope 正確套用', () => {
    it('user scope 套用 scope-badge--user', () => {
      const { container } = render(<ScopeBadge scope="user" />);
      const span = container.querySelector('span');
      expect(span?.className).toContain('scope-badge--user');
      expect(span?.className).toContain('scope-badge');
    });

    it('project scope 套用 scope-badge--project', () => {
      const { container } = render(<ScopeBadge scope="project" />);
      expect(container.querySelector('span')?.className).toContain('scope-badge--project');
    });

    it('local scope 套用 scope-badge--local', () => {
      const { container } = render(<ScopeBadge scope="local" />);
      expect(container.querySelector('span')?.className).toContain('scope-badge--local');
    });
  });

  describe('有 projectPath 時顯示縮短路徑', () => {
    it('路徑超過兩層時只顯示最後兩層', () => {
      render(<ScopeBadge scope="project" projectPath="/home/user/projects/my-app" />);
      expect(screen.getByText('project: .../projects/my-app')).toBeTruthy();
    });

    it('路徑剛好兩層時顯示完整路徑', () => {
      render(<ScopeBadge scope="project" projectPath="/projects/my-app" />);
      expect(screen.getByText('project: /projects/my-app')).toBeTruthy();
    });

    it('路徑只有一層時顯示完整路徑', () => {
      render(<ScopeBadge scope="project" projectPath="/my-app" />);
      expect(screen.getByText('project: /my-app')).toBeTruthy();
    });

    it('Windows 反斜線路徑正確縮短', () => {
      const { container } = render(
        <ScopeBadge scope="project" projectPath="C:\\Users\\user\\projects\\my-app" />,
      );
      expect(container.querySelector('span')?.textContent).toBe('project: .../projects/my-app');
    });
  });
});
