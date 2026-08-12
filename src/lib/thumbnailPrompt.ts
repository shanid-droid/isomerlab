export interface GenerateThumbnailPromptOptions {
  projectName: string;
  projectDescription: string;
  hasProductImage: boolean;
}

function imageInstruction(hasProductImage: boolean): string {
  if (hasProductImage) {
    return "The uploaded project image is the primary visual reference. Preserve the actual product's identity.";
  }
  return 'No product image is currently uploaded. Create a realistic representation based on the project name and description.';
}

/**
 * Builds a complete ISOMER LAB thumbnail prompt for external AI image generators.
 * Generated dynamically from current project form values — never stored in the database.
 */
export function generateThumbnailPrompt({
  projectName,
  projectDescription,
  hasProductImage,
}: GenerateThumbnailPromptOptions): string {
  const name = projectName.trim() || 'Untitled Project';
  const description = projectDescription.trim() || 'No description provided.';
  const referenceLine = imageInstruction(hasProductImage);

  return `Create a premium professional project thumbnail for a futuristic technology portfolio website called "ISOMER LAB".

PROJECT NAME:
${name}

PROJECT DESCRIPTION:
${description}

REFERENCE / UPLOADED PRODUCT IMAGE:
${referenceLine}

IMPORTANT:
The final thumbnail MUST clearly include the actual product shown in the uploaded image.

If an image is provided:
- Preserve the product's identity, shape, structure, proportions, important details and recognizable features.
- Do NOT replace it with a different product.
- Do NOT unnecessarily redesign or distort it.
- Improve its presentation using professional lighting, composition and environment.

If NO product image is provided:
- Create a realistic visual representation of the product based on the project name and description.
- Make the generated product visually relevant to the actual project.

==================================================
ISOMER LAB VISUAL STYLE
==================================================

Create a premium futuristic engineering/technology aesthetic.

Visual characteristics:

- dark near-black background
- deep forest/emerald green atmosphere
- subtle green illumination
- sophisticated technological environment
- premium studio lighting
- realistic materials
- cinematic depth
- subtle reflections
- controlled shadows
- minimal futuristic geometry
- elegant technical details
- clean composition
- high-end product photography
- professional engineering portfolio aesthetic

Use green as the primary accent.

Avoid:
- blue
- purple
- pink
- rainbow colors
- excessive neon
- cartoon style
- childish graphics
- generic stock-photo appearance
- excessive visual effects
- clutter
- unrealistic glowing objects

==================================================
PRODUCT PRESENTATION
==================================================

The product must be the MAIN visual focus.

Place the product prominently in the composition.

Use realistic perspective and professional lighting.

Create a subtle futuristic environment around it that communicates the project's technology without distracting from the product.

The environment should be derived from the PROJECT DESCRIPTION.

==================================================
PROJECT NAME
==================================================

The thumbnail MUST include the PROJECT NAME as professionally designed typography.

Display:

${name}

Use a clean futuristic sans-serif typeface.

Typography should be:

- highly readable
- premium
- minimal
- modern
- white or very light gray
- subtle ISOMER green accent if appropriate

Do NOT misspell the project name.

Do NOT add unnecessary text.

Do NOT add fake specifications, fake statistics, fake logos or random words.

==================================================
LAYOUT
==================================================

Aspect ratio: 16:9.

Create a professional portfolio-card composition.

Recommended structure:

- product: dominant visual element
- project name: clearly visible but secondary to the product
- background: dark futuristic ISOMER LAB environment
- green lighting: subtle and controlled
- negative space: sufficient to keep the composition clean

The thumbnail must remain recognizable and readable even when displayed as a small project card.

==================================================
QUALITY
==================================================

Photorealistic / high-end 3D product visualization.

Sharp details.

Professional studio-quality lighting.

Realistic shadows and reflections.

High dynamic range.

Cinematic but restrained.

Premium technology-company presentation.

The final result should look like it was designed by a professional technology brand, NOT like a generic AI image.

==================================================
MOST IMPORTANT REQUIREMENTS
==================================================

1. The PRODUCT must be clearly visible.
2. The PROJECT NAME must be clearly readable.
3. The product must match the uploaded image or project description.
4. The thumbnail must use the ISOMER LAB dark green futuristic identity.
5. The design must be clean and professional.
6. Do not overcrowd the image.
7. Do not add unrelated objects.
8. Do not change the product into something else.
9. Do not generate incorrect text.
10. Do not use random colors.
11. Do not add unnecessary logos or branding.
12. Make the final image look like an official ISOMER LAB project thumbnail.

Output ONLY the finished 16:9 thumbnail.`;
}
