export const createTableDragImage = (label: string) => {
  const element = document.createElement('div');
  element.textContent = label;
  element.style.cssText = `
    position: fixed;
    top: -1000px;
    left: -1000px;
    z-index: -1;
    padding: 6px 10px;
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 6px;
    color: #fff;
    font-size: 12px;
    line-height: 18px;
    white-space: nowrap;
    background: rgba(0, 0, 0, 0.78);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
  `;
  document.body.append(element);
  setTimeout(() => element.remove());
  return element;
};
