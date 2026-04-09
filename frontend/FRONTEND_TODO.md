# Frontend TODO — Audit de qualité

## 🔴 CRITIQUE — Features complètes mais inaccessibles

- [ ] **[UX]** `ActivityLog` et `AccountSwitcherModal` existent (~18KB et ~31KB) mais ne sont **pas montés dans `SettingsPage`** — ces sections sont invisibles pour l'utilisateur. Ajouter les imports et les sections correspondantes dans `SettingsPage.tsx`.
- [ ] **[UX]** Aucun lien vers `/organization-admin` dans la `Sidebar` ni le `Header` — la page `OrganizationAdminPage` est inaccessible sans connaître l'URL directe. Ajouter une entrée dans la navigation (visible si l'utilisateur a au moins une organisation).

---

## 🟠 HAUTE PRIORITÉ — Court terme

### i18n
- [ ] **[i18n]** Les toasts Socket.io dans `SocketListener.tsx` sont écrits **en dur en français** (lignes ~46-50, 73-75, 103-104) — les utilisateurs en anglais verront des messages français. Remplacer par `t('socket.comment_added')`, `t('socket.share_received')`, `t('socket.share_accepted')`.

### Sécurité UX
- [ ] **[Sécurité]** Ajouter un message d'alerte dans `FilePreviewModal` lors du **téléchargement de fichiers de script potentiellement dangereux** (`.sh`, `.bat`, `.ps1`, `.exe`, `.cmd`, `.py`, `.js` exécutables) — afficher un bandeau warning avant le téléchargement.

### Cohérence
- [ ] **[UX]** Vérifier que `formatBytes()` est utilisé **partout de façon cohérente** pour l'affichage des tailles (ko/Mo/Go) — certains endroits affichent peut-être des octets bruts ou des formats différents.
- [ ] **[UX]** La page **Partages** (`SharedPage`) : les fichiers partagés ne sont pas soumis au même système de tri que les fichiers normaux. Aligner le comportement de tri.

---

## 🟡 MOYEN TERME

### Navigation
- [ ] Quand on clique sur une notification de type `SHARE` dans le `NotificationCenter`, vérifier que la redirection vers `/files/:folderId` ou `/files?preview=:fileId` fonctionne correctement dans tous les cas (fichier supprimé, dossier supprimé, etc.) — actuellement pas de gestion d'erreur si la ressource n'existe plus.

### Upload
- [ ] Le store `useUploadStore` vérifie le quota **côté client** avant l'upload (optimiste). Si le quota change entre deux sessions, la vérification peut être inexacte. Garder la vérification client comme UX hint mais afficher proprement l'erreur 413 retournée par le backend.

### Accessibilité
- [ ] Ajouter des attributs `aria-label` sur les boutons d'icône (suppression, favoris, téléchargement) dans `FilesPage` et `FavoritesPage`.

### Code
- [ ] `PlansPage` contient encore un commentaire `// Simulation Stripe Checkout` avec un `setTimeout` de 1500ms artificiel (ligne 143). À nettoyer — soit on documente pourquoi, soit on le retire si le vrai checkout Stripe est configuré.
- [ ] Plusieurs composants utilisent `any` pour typer les données Socket.io (`data: any` dans `SocketListener.tsx`). Créer des types TypeScript dédiés pour chaque event Socket.

---

## 🟢 LONG TERME / POLISH

- [ ] **Thème** : Le thème clair/sombre est sauvegardé en base via l'API mais rechargé uniquement au montage. Si l'utilisateur change de thème sur un autre onglet, l'état n'est pas synchronisé. Écouter l'event `storage` ou utiliser le Socket.
- [ ] **Mobile** : L'interface est responsive mais pas optimisée pour le touch (ex: drag & drop ne fonctionne pas sur mobile). Prévoir une version tactile du déplacement (long press → move).
- [ ] **Performance** : `FilesPage` (~37KB) est monolithique. Envisager de découper en sous-composants (`FileGrid`, `FileList`, `FileActions`, `FolderTree`) pour faciliter la maintenance.
- [ ] **Pagination** : La liste de fichiers charge tout d'un coup. Implémenter `IntersectionObserver` pour un scroll infini ou une pagination explicite sur les grands dossiers.
- [ ] **PWA** : Le service worker push est enregistré (`pushNotification.ts`) mais l'app n'est pas encore une vraie PWA (pas de manifest, pas d'offline).

---

## Stats

| Catégorie | Nb. problèmes |
|---|---|
| Features inaccessibles | 2 |
| i18n | 1 |
| Sécurité UX | 1 |
| Cohérence | 2 |
| Navigation / UX | 1 |
| Upload | 1 |
| Code / TypeScript | 2 |
| Long terme / Polish | 5 |
| **Total** | **15** |
