export interface ChatGptSample {
  id: string;
  name: string;
  description: string;
  mode: "document" | "conversation";
  title: string;
  subtitle: string;
  author: string;
  model: string;
  prompt?: string;
  content: string;
}

export const CHATGPT_SAMPLES: ChatGptSample[] = [
  {
    id: "nextjs-guide",
    name: "How to Build a Next.js Project",
    description: "Step-by-step developer tutorial with terminal commands and explanations.",
    mode: "document",
    title: "How to Build a Next.js Project?",
    subtitle: "A step-by-step developer guide for creating modern web applications",
    author: "ChatGPT Assistant",
    model: "GPT-4o",
    content: `# How to Build a Next.js Project?

Next.js is a powerful React framework for building modern web applications. It provides features like server-side rendering, static site generation, and API routes.

### Step-by-Step Guide

1. Create a new Next.js app:
   \`\`\`bash
   npx create-next-app@latest my-app
   \`\`\`

2. Navigate to your project:
   \`\`\`bash
   cd my-app
   \`\`\`

3. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`
`,
  },
  {
    id: "ai-guide",
    name: "AI & Neural Networks Guide",
    description: "Technical guide with LaTeX math equations, code snippet, and comparison table.",
    mode: "document",
    title: "Understanding Transformer Architectures & Attention",
    subtitle: "A comprehensive guide on self-attention mechanisms and modern LLMs",
    author: "ChatGPT-4o Assistant",
    model: "GPT-4o",
    content: `# Understanding Transformer Architectures & Attention

The Transformer architecture, introduced in the seminal paper *"Attention Is All You Need"* (Vaswani et al., 2017), revolutionized Natural Language Processing and modern generative AI.

---

## 1. The Core Principle: Scaled Dot-Product Attention

At the heart of the Transformer is the **Scaled Dot-Product Attention** mechanism. Given query matrices $Q$, key matrices $K$, and value matrices $V$:

$$\\text{Attention}(Q, K, V) = \\text{softmax}\\left( \\frac{Q K^T}{\\sqrt{d_k}} \\right) V$$

Where:
- $Q \\in \\mathbb{R}^{n \\times d_k}$: Query representation matrix
- $K \\in \\mathbb{R}^{m \\times d_k}$: Key representation matrix
- $V \\in \\mathbb{R}^{m \\times d_v}$: Value representation matrix
- $d_k$: Dimensionality of the keys

---

## 2. Python Implementation (PyTorch)

\`\`\`python
import torch
import torch.nn.functional as F

def scaled_dot_product_attention(query, key, value, mask=None):
    d_k = query.size(-1)
    scores = torch.matmul(query, key.transpose(-2, -1)) / (d_k ** 0.5)
    if mask is not None:
        scores = scores.masked_fill(mask == 0, -1e9)
    weights = F.softmax(scores, dim=-1)
    return torch.matmul(weights, value), weights
\`\`\`

### Architecture Comparison
| Feature | RNN / LSTM | Transformer |
| :--- | :--- | :--- |
| **Sequential Processing** | Yes (O(n) steps) | No (Parallel $O(1)$) |
| **Long-range Dependencies** | Vanishing gradient risk | Direct attention paths |
| **Training Speed** | Slow, iterative | Highly scalable on GPUs |
`,
  },
];
