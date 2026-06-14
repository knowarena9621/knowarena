# KnowArena — Smart Test Platform (Class 6–12)

Ye ek React + Vite project hai. Niche diye steps follow karke aap ise
free me website ke roop me deploy kar sakte ho.

---

## Option 1: Vercel se Deploy Karein (Sabse Easy)

1. **GitHub account** banayein (agar nahi hai): https://github.com
2. Iss folder ka content ek naye GitHub repository me upload karein:
   - GitHub.com pe "New repository" → naam `knowarena` rakhein → Create
   - "uploading an existing file" link pe click karke ye sab files/folders
     drag-and-drop karein
3. **Vercel** pe jaayein: https://vercel.com
4. "Sign up" → "Continue with GitHub" se login karein
5. Dashboard pe **"Add New" → "Project"**
6. Apna `knowarena` repository select karein → **"Import"**
7. Settings automatically detect ho jaayengi (Vite project hai):
   - Framework Preset: **Vite**
   - Build Command: `npm run build` (auto-filled)
   - Output Directory: `dist` (auto-filled)
8. **"Deploy"** dabayein
9. 1-2 minute me aapki website live ho jayegi —
   link kuch aisa hoga: `https://knowarena.vercel.app`

✅ Ab ye link kisi ko bhi bhejo, browser me khul jayega!

---

## Option 2: Netlify (Drag & Drop — bina GitHub ke)

1. Apne computer par terminal/command prompt khole, is folder me jaaein
2. Ye commands chalayein:
   ```bash
   npm install
   npm run build
   ```
3. Ek `dist` folder ban jayega
4. https://app.netlify.com pe jaayein → "Add new site" → "Deploy manually"
5. `dist` folder ko seedha browser me drag-drop kar dein
6. Live link mil jayega — e.g. `https://knowarena.netlify.app`

---

## Local Computer Pe Test Karna (Optional)

```bash
npm install
npm run dev
```
Phir browser me `http://localhost:5173` khole.

---

## Custom Domain Lagana (Optional, Baad Me)

Vercel/Netlify dono me free custom domain (e.g. `knowarena.in`) connect
karne ka option hai — Settings → Domains me jaake apna domain add kar
sakte ho (domain khareedna alag se hota hai, GoDaddy/Namecheap se).

---

## Note

Ye app abhi **demo/mock data** ke saath chal rahi hai (frontend only).
Real students/teachers ke liye Firebase backend connect karna hoga —
woh files `knowarena-backend/` folder me already di gayi hain, aur
`docs/CONNECTING_TO_APP.md` me steps likhe hain.
