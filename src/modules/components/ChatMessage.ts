export function addMessage(doc: Document, container: Element | null, text: string, sender: 'user' | 'ai') {
  if (!container) return;

  const messageDiv = doc.createElement('div');

  messageDiv.style.wordWrap = 'break-word';
  messageDiv.style.display = 'block';
  messageDiv.style.marginBottom = '8px';

  if (sender === 'user') {
    messageDiv.style.maxWidth = '70%';
    messageDiv.style.padding = '8px';
    messageDiv.style.borderRadius = '8px';
    messageDiv.style.backgroundColor = '#FFFFFF';
    messageDiv.style.marginLeft = 'auto';
  } else {
    messageDiv.style.maxWidth = '70%';
    messageDiv.style.padding = '8px';
    messageDiv.style.borderRadius = '8px';
    messageDiv.style.backgroundColor = '#e6f2ff';
    messageDiv.style.marginRight = 'auto';
  }

  messageDiv.textContent = text;

  const wrapperDiv = doc.createElement('div');
  wrapperDiv.style.width = '100%';
  wrapperDiv.style.display = 'flex';
  wrapperDiv.style.flexDirection = sender === 'user' ? 'row-reverse' : 'row';
  wrapperDiv.appendChild(messageDiv);

  container.appendChild(wrapperDiv);
  container.scrollTop = container.scrollHeight;
}

