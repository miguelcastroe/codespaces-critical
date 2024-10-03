const apiKey = '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';  // Inserted API key

// Function to handle text minimization
async function minimizeText() {
  const inputText = document.getElementById('input-text').value;
  const language = document.getElementById('language').value;
  const minimizeButton = document.getElementById('minimize-button');
  const messageBox = document.getElementById('message-box');
  const outputText = document.getElementById('output-text');

  if (!inputText) {
    messageBox.textContent = (language === 'en') ? 'Please enter some text.' : 'Por favor, ingrese un texto.';
    return;
  }

  // Disable button while processing
  minimizeButton.disabled = true;
  minimizeButton.textContent = (language === 'en') ? 'Minimizing...' : 'Minimizando...';

  try {
    const prompt = (language === 'en') 
      ? `Minimize the following text while keeping its key information intact: ${inputText}` 
      : `Minimiza el siguiente texto manteniendo su información clave intacta: ${inputText}`;

    const response = await fetch('https://api.openai.com/v1/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4",
        prompt: prompt,
        max_tokens: 150,
        temperature: 0.5
      })
    });

    const data = await response.json();
    outputText.value = data.choices[0].text.trim();
    messageBox.textContent = '';  // Clear any error messages
  } catch (error) {
    messageBox.textContent = (language === 'en') ? 'Error minimizing text. Please try again.' : 'Error al minimizar el texto. Por favor, inténtelo de nuevo.';
  }

  // Re-enable button
  minimizeButton.disabled = false;
  minimizeButton.textContent = (language === 'en') ? 'Minimize Text' : 'Minimizar Texto';
}

// Function to handle language change
function changeLanguage() {
  const language = document.getElementById('language').value;
  document.getElementById('title').textContent = (language === 'en') ? 'Text Minimizer' : 'Minimizador de Texto';
  document.getElementById('input-label').textContent = (language === 'en') ? 'Enter your text to minimize:' : 'Ingrese su texto para minimizar:';
  document.getElementById('minimize-button').textContent = (language === 'en') ? 'Minimize Text' : 'Minimizar Texto';
  document.getElementById('output-label').textContent = (language === 'en') ? 'Minimized Text:' : 'Texto Minimizado:';
}
