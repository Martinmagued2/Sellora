import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { generateProductImage } from "@/lib/ai/image-generator";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    // Authenticate user
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { product_name, description, style } = body;

    if (!product_name) {
      return Response.json({ error: "Product name is required" }, { status: 400 });
    }

    // Build the image generation prompt
    const styleStr = style?.toLowerCase()?.trim() || "studio";
    const stylePrompt = {
      studio:
        "professional product photography on clean white background, studio lighting, high-end e-commerce style, centered composition, sharp focus",
      lifestyle:
        "lifestyle product photography, product shown in realistic use context, warm natural lighting, appealing scene, soft shadows",
      minimal:
        "minimalist product photography, simple elegant composition, soft neutral gradient background, refined and modern aesthetic",
    }[styleStr] ||
      "professional product photography on clean white background, studio lighting, high-end e-commerce style";

    const prompt = `${stylePrompt}. Product: ${product_name}${description ? `. ${description}` : ""}. High quality, 4K, commercial photography, no text, no watermark, no people visible.`;

    // Generate image using shared utility (ZAI + Google Imagen fallback)
    const result = await generateProductImage(prompt, { size: "1024x1024" });

    if (!result.success) {
      return Response.json({ error: result.error }, { status: 500 });
    }

    const { imageBase64, source } = result;

    // Upload to Supabase Storage
    const imageBuffer = Buffer.from(imageBase64, "base64");
    const storagePath = `products/${user.id}/${Date.now()}.png`;
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from("product-images")
      .upload(storagePath, imageBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    let imageUrl;
    if (!uploadError && uploadData) {
      const { data: urlData } = supabaseAdmin.storage
        .from("product-images")
        .getPublicUrl(storagePath);
      imageUrl = urlData?.publicUrl;
    } else {
      // Fallback: return base64 data URL if storage upload fails
      imageUrl = `data:image/png;base64,${imageBase64}`;
      console.warn("[Generate-Image] Storage upload failed, returning base64 data URL");
    }

    console.log(`[Generate-Image] Image generated for "${product_name}" (${styleStr}) via ${source}`);

    return Response.json({
      success: true,
      image_url: imageUrl,
      image_base64: imageBase64, // Also return base64 so the form can preview immediately
      source,
    });
  } catch (error) {
    console.error("[Generate-Image] Error:", error.message);
    return Response.json(
      { error: error.message || "Image generation failed" },
      { status: 500 }
    );
  }
}
