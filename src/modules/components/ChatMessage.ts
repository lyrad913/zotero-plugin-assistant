export function addMessage(doc: Document, container: Elemnet | null, text: string, sender: 'user' | 'ai') {
  if (!container) return;

  const messageDiv = doc.createElement('div');
  messageDiv.style.maxWidth = '70%';
  messageDiv.style.padding = '8px';
  messageDiv.style.borderRadius = '8px';
  messageDiv.style.marginBottom = '8px';
  messageDiv.style.wordWrap = 'break-word';
  messageDiv.style.display = 'block';

  if (sender === 'user') {
    messageDiv.style.backgroundColor = '#FFFFFF';
    messageDiv.style.marginLeft = 'auto';
  } else {
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

