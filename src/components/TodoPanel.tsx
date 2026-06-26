import { Fragment } from 'react';
import { useAppConfig } from '../app/AppConfigContext';
import { useTodos } from '../hooks/useTodos';
import { getTodoSections } from '../todoLogic.js';
import { TodoItem } from './TodoItem';

export function TodoPanel() {
  const { chatDays } = useAppConfig();
  const { data: todos = [] } = useTodos(chatDays);

  const sections = getTodoSections();
  const open = todos.filter((t) => !t.is_completed).length;
  const done = todos.filter((t) => t.is_completed).length;

  return (
    <aside className="todo-panel">
      <div className="todo-header">
        <div className="todo-title">Active Todos</div>
        <div className="todo-count" id="todoCount">
          {open} open · {done} done
        </div>
      </div>
      <div className="todo-list" id="todoList">
        {sections.map((section) => {
          const items = todos.filter(section.filter);
          if (items.length === 0) return null;
          return (
            <Fragment key={section.label}>
              <div className="todo-section-label">{section.label}</div>
              {items.map((todo) => (
                <TodoItem key={todo.id} todo={todo} />
              ))}
            </Fragment>
          );
        })}
      </div>
    </aside>
  );
}
