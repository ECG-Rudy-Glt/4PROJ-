# Structure des avatars de l'IA

## Organisation des fichiers

### Dossier `idle/`
Place ici tes images PNG pour l'état de repos de l'IA.
- Format : PNG (transparence supportée)
- Taille recommandée : 80x80px minimum
- Nommage : n'importe quel nom (ex: `avatar1.png`, `avatar2.png`, etc.)

L'IA choisira aléatoirement parmi ces images quand elle est inactive.

### Dossier `working/`
Place ici tes images GIF pour l'état actif de l'IA.
- Format : GIF animé
- Taille recommandée : 80x80px minimum
- Nommage : n'importe quel nom (ex: `working1.gif`, `working2.gif`, etc.)

L'IA choisira aléatoirement parmi ces GIF quand elle traite une requête.

## Exemple de structure
```
ai-avatar/
├── idle/
│   ├── neutral.png
│   ├── happy.png
│   └── thinking.png
└── working/
    ├── processing.gif
    ├── typing.gif
    └── analyzing.gif
```
