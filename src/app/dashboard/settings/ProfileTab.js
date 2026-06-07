"use client";

import { Upload } from "lucide-react";
import { useToast } from "../components/ToastProvider";

export default function ProfileTab({ account, updateField, supabase, uploadingLogo, setUploadingLogo }) {
  const toast = useToast();
  return (
    <div className="dashboard-panel">
      <div className="dashboard-panel-header">
        <h3>Business Profile</h3>
      </div>
      <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
        {/* Logo Upload */}
        <div className="form-group">
          <label className="form-label">Business Logo</label>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-lg)" }}>
            <div style={{
              width: 80, height: 80, borderRadius: "var(--radius-lg)",
              background: account.logo_url ? "transparent" : "var(--accent-gradient)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "28px", fontWeight: 800, overflow: "hidden",
            }}>
              {account.logo_url ? (
                <img src={account.logo_url} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "var(--radius-lg)" }} />
              ) : (
                account.business_name?.charAt(0) || "S"
              )}
            </div>
            <div>
              <button className="btn btn-secondary btn-sm" disabled={uploadingLogo} onClick={async () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/png,image/jpeg';
                input.onchange = async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  if (file.size > 2 * 1024 * 1024) { toast.warning('File must be under 2MB'); return; }
                  setUploadingLogo(true);
                  try {
                    const ext = file.name.split('.').pop();
                    const { data: { user } } = await supabase.auth.getUser();
                    const path = `${user.id}/logo.${ext}`;

                    // Ensure the logos bucket exists before uploading
                    try {
                      await fetch("/api/storage/ensure-buckets", { method: "POST" });
                    } catch (e) {}

                    // Try client-side upload first
                    const { error: uploadErr } = await supabase.storage.from('logos').upload(path, file, { upsert: true });

                    let logoUrl;
                    if (uploadErr) {
                      // Fallback: upload via admin API (bypasses RLS, auto-creates bucket)
                      console.warn('[Settings] Client logo upload failed, trying admin:', uploadErr.message);
                      const formData = new FormData();
                      formData.append('file', file);
                      formData.append('path', path);
                      formData.append('bucket', 'logos');
                      const adminRes = await fetch('/api/storage/upload', { method: 'POST', body: formData });
                      if (!adminRes.ok) {
                        const errData = await adminRes.json();
                        throw new Error(errData.error || 'Upload failed');
                      }
                      const adminData = await adminRes.json();
                      logoUrl = adminData.url;
                    } else {
                      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path);
                      logoUrl = urlData.publicUrl;
                    }

                    if (logoUrl) {
                      await supabase.from('accounts').update({ logo_url: logoUrl }).eq('id', user.id);
                      updateField('logo_url', logoUrl);
                    }
                  } catch (err) { toast.error('Upload failed: ' + err.message); }
                  finally { setUploadingLogo(false); }
                };
                input.click();
              }}>
                <Upload size={14} /> {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
              </button>
              <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: 6 }}>
                PNG, JPG up to 2MB. Recommended: 200x200px
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-lg)" }}>
          <div className="form-group">
            <label className="form-label">Business Name</label>
            <input type="text" className="form-input" value={account.business_name || ""} onChange={(e) => updateField("business_name", e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Industry</label>
            <input type="text" className="form-input" value={account.industry || ""} onChange={(e) => updateField("industry", e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Business Description</label>
          <textarea className="form-input form-textarea" value={account.business_description || ""} onChange={(e) => updateField("business_description", e.target.value)} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-lg)" }}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-input" value={account.email || ""} readOnly style={{ opacity: 0.6 }} />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input type="tel" className="form-input" value={account.phone || ""} onChange={(e) => updateField("phone", e.target.value)} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-lg)" }}>
          <div className="form-group">
            <label className="form-label">Country</label>
            <input type="text" className="form-input" value={account.country || ""} onChange={(e) => updateField("country", e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Currency</label>
            <input type="text" className="form-input" value={account.currency || ""} onChange={(e) => updateField("currency", e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Website / Social Links</label>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
            <input type="text" className="form-input" value={account.instagram_url || ""} onChange={(e) => updateField("instagram_url", e.target.value)} placeholder="instagram.com/mystore" />
            <input type="text" className="form-input" value={account.facebook_url || ""} onChange={(e) => updateField("facebook_url", e.target.value)} placeholder="Facebook page URL" />
            <input type="text" className="form-input" value={account.website_url || ""} onChange={(e) => updateField("website_url", e.target.value)} placeholder="Website URL" />
          </div>
        </div>
      </div>
    </div>
  );
}
