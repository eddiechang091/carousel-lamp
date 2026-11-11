import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';

export const SUPPORTED_LOCALES = ['en', 'fr', 'es', 'zh'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

const STORAGE_KEY = 'carousel-lamp-locale';

type Entry = Record<string, string>;

const en: Entry = {
  'loading.starting': 'Lighting up your carousel…',
  'error.sceneLoadFailed': "The scene didn't load. Please refresh and try again.",
  'error.webglUnsupported':
    "This browser can't display the 3D scene. Enable hardware acceleration or try another browser.",
  'error.decorationLoad': 'A decoration failed to load. Please refresh and try again.',
  'error.viewSave':
    "This browser can't save the view and mode. Check your site storage settings.",
  'error.sceneInterrupted': 'The scene was interrupted. Please refresh and reopen.',
  'error.cannotReadOriginal':
    "The original photo couldn't be read. Please choose another.",
  'error.photoReadFailed': "The photo couldn't be read. The position didn't change.",
  'error.exchangeBusy': 'Please wait a moment before swapping photos.',
  'error.swapFailed': "The swap didn't work. Please try again.",
  'error.savingInProgress': 'Saving is in progress. Please wait.',
  'error.unsupportedFormat':
    'Please choose a JPG, PNG, WebP or HEIC/HEIF photo.',
  'error.fileTooLarge': 'Please choose a photo under 50 MB.',
  'error.tooManyFiles':
    'There are {count} empty frames. Please choose at most {count} photos.',
  'error.invalidFile':
    "{name} isn't valid: choose a single JPG, PNG, WebP or HEIC/HEIF under 50 MB.",
  'error.savedButNotUpdated':
    "The photos were saved, but the scene didn't finish updating. Please reopen the app.",
  'error.batchFailed': '{message} None of the batch photos were attached.',
  'error.previewFailed':
    "Couldn't create a photo preview. Please try again.",
  'error.decodeFailed':
    "This photo couldn't be decoded. The format may be unsupported or the file corrupted. Re-export it as JPG or PNG and try again.",
  'error.heicTimeout':
    'Processing took too long. Try a smaller photo, or export it as JPG and retry.',
  'error.heicConvert': 'Photo conversion failed. Please try again.',
  'error.heicWorker':
    "Couldn't start HEIC conversion. Refresh the page or try another browser.",
  'error.heicWorkerFailed':
    "This HEIC photo couldn't be converted right now. Try another photo, or export it as JPG and retry.",
  'error.storageOpen':
    "Couldn't open local photo storage. Check your browser's site storage settings.",
  'error.storageBlocked':
    'Photo storage is busy in another tab. Close the other tab and try again.',
  'error.storageRead':
    "Couldn't read saved photos. Please refresh and try again.",
  'error.storageSaveNoChange':
    "The photo couldn't be saved. The position didn't change.",
  'error.storageFull':
    "The photo couldn't be saved. Storage may be full. Free up space and try again.",
  'batch.preparing': 'Preparing {current} / {total}…',
  'batch.saving': 'Saving photos…',
  'notice.batchUploaded':
    'Attached {count} photos to empty frames at random and saved them on this device.',
  'notice.photoAttached':
    'Photo attached to position {number}. Saved on this device.',
  'notice.photosSwapped': 'Photos {from} and {to} swapped and saved.',
  'notice.photoRemoved': 'Photo removed. This position is free again.',
  'notice.resumedSpinning': 'Back to the whole lamp, the carousel keeps spinning.',
  'status.saving': 'Saving…',
  'status.saveFailed': "Saving didn't finish. Please retry.",
  'credit.personalUse': 'For personal, non-commercial use only.',
  'action.hangPhoto': 'Add photo',
  'action.wind': 'Wind',
  'action.spin': 'Spin',
  'action.pause': 'Pause',
  'action.turnOn': 'Lights on',
  'action.turnOff': 'Lights off',
  'action.wholeLamp': 'Whole lamp',
  'action.addPhoto': 'Add photo',
  'action.replaceAdjust': 'Replace / adjust',
  'action.removePhoto': 'Remove photo',
  'action.choosePosition': 'Pick a spot',
  'action.batchUpload': 'Batch upload',
  'action.music': 'Music',
  'action.mute': 'Mute',
  'action.cancel': 'Cancel',
  'drag.hint': 'Drag onto another photo to swap',
  'drag.releaseTo': 'Release to swap to {number}',
  'a11y.previous': 'Previous photo',
  'a11y.next': 'Next photo',
  'a11y.captionInput': 'Mood caption',
  'a11y.saveCaption': 'Save caption',
  'a11y.clearCaption': 'Clear caption',
  'a11y.aiCaption': 'Generate a poetic caption with AI',
  'action.aiCaption': 'AI caption',
  'ai.captionGenerating': 'Dreaming up a line…',
  'ai.captionReady': 'AI caption ready — edit it, then save',
  'ai.captionFailed': "Couldn't dream up a caption — try again",
  'ai.captionRetry': 'Try again',
  'model.title': 'Model',
  'model.dashboardTitle': 'Model & usage',
  'model.default': 'Server default',
  'model.loading': 'Loading models…',
  'model.error': "Couldn't load the model list",
  'model.noModels': 'No models configured yet',
  'model.usageTitle': 'Token usage',
  'model.noUsage': 'No AI calls yet — hang a photo and the chart fills in.',
  'model.latest': 'Latest: {tokens} tokens · {model}',
  'model.usageNote': 'Usage is stored on this device only.',
  'model.close': 'Close',
  'a11y.modelButton': 'Model settings',
  'pony.thinking': 'Dreaming up festival facts…',
  'pony.nudge': 'Psst — tap me for a festival story!',
  'pony.error': "Couldn't reach the festival storyteller — tap to try again.",
  'pony.retry': 'Try again',
  'pony.factsNote': 'Festival facts are AI-generated.',
  'pony.factsNoteSearched': 'Fresh from a live web search via Otari.',
  'a11y.pony': 'Festival pony — tap for festival facts',
  'ai.captionUnavailable': 'AI captions are unavailable right now — check the Otari setup and try again',
  'theme.auto': 'Auto',
  'theme.default': 'Classic',
  'theme.new-year': "New Year's Day",
  'theme.valentine': "Valentine's Day",
  'theme.spring-festival': 'Spring Festival',
  'theme.carnival': 'Carnival',
  'theme.st-patrick': "St. Patrick's Day",
  'theme.april-fools': "April Fools' Day",
  'theme.easter': 'Easter',
  'theme.mothers-day': "Mother's Day",
  'theme.dragon-boat': 'Dragon Boat Festival',
  'theme.mid-autumn': 'Mid-Autumn Festival',
  'theme.halloween': 'Halloween',
  'theme.diwali': 'Diwali',
  'theme.thanksgiving': 'Thanksgiving',
  'theme.christmas': 'Christmas',
  'a11y.themePicker': 'Choose a holiday theme',
  'label.captionPlaceholder': 'Write a short mood…',
  'action.export': 'Export',
  'notice.exported': 'Polaroid image exported',
  'error.emptyFrame': 'This frame is empty — add a photo or a caption first',
  'a11y.resetView': 'Reset view',
  'a11y.musicOn': 'Mute background music',
  'a11y.musicOff': 'Play background music',
  'a11y.choosePosition': 'Choose photo position',
  'a11y.closePicker': 'Close position picker',
  'a11y.cropPreview': 'Cropped photo preview',
  'a11y.scene':
    'Draggable 3D photo carousel lamp; you can also use the buttons below to choose photos',
  'label.photoCounter': 'Photo {number} / {total}',
  'dialog.uploadTitle': 'Hang up your photos',
  'dialog.uploadDesc':
    '{count} empty frames left. Batch upload fills empty spots at random; existing photos stay in place.',
  'dialog.framesFull': 'All frames are full. Tap a photo to replace it.',
  'dialog.batchHelp':
    'JPG, PNG, WebP, HEIC · up to 50 MB each · choose as many as there are empty frames',
  'picker.stepOne': 'Step 1',
  'picker.title': 'Choose a spot for your photo',
  'picker.hint': 'Tap a photo below to see where it hangs.',
  'picker.slotLabel': 'Choose position {number}',
  'picker.slotHasPhoto': ', has your photo',
  'picker.slotEmpty': ', empty',
  'picker.attached': ' · attached',
  'picker.hangAt': 'Hang at position {number}',
  'picker.selectFirst': 'Choose a position first',
  'editor.title': 'Hang at position {number}',
  'editor.description':
    'Pick a photo, adjust the framing, then hang this moment. Photos are saved only in this browser and never uploaded.',
  'editor.convertingHeic': 'Converting HEIC photo…',
  'editor.reading': 'Reading photo…',
  'editor.pickPhoto': 'Choose a photo you love',
  'editor.chooseAnother': 'Choose another photo',
  'editor.choosePhoto': 'Choose a photo',
  'editor.formatHelp': 'JPG, PNG, WebP, HEIC/HEIF · up to 50 MB',
  'editor.convertingHeicNote':
    'Converting HEIC photo. Larger photos may take a moment…',
  'editor.zoom': 'Zoom',
  'editor.horizontal': 'Horizontal',
  'editor.vertical': 'Vertical',
  'editor.resetCrop': 'Reset crop',
  'editor.preparing': 'Preparing…',
  'editor.confirm': 'Hang it',
  'notFound.title': 'Error',
  'notFound.description':
    "The page may have been removed or doesn't exist. Please check the URL.",
  'notFound.backHome': 'Back to home',
  'notFound.pageTitle': 'Page not found',
  'error.appCrashed': 'Something went wrong. Please refresh the page and try again.',
  'lang.label': 'Language',
  'lang.en': 'English',
  'lang.fr': 'Français',
  'lang.es': 'Español',
  'lang.zh': '中文',
};

const fr: Entry = {
  'loading.starting': 'Allumage de votre carrousel…',
  'error.sceneLoadFailed':
    "La scène n'a pas chargé. Veuillez actualiser et réessayer.",
  'error.webglUnsupported':
    "Ce navigateur ne peut pas afficher la scène 3D. Activez l'accélération matérielle ou essayez un autre navigateur.",
  'error.decorationLoad':
    "Une décoration n'a pas chargé. Veuillez actualiser et réessayer.",
  'error.viewSave':
    "Ce navigateur ne peut pas enregistrer la vue et le mode. Vérifiez les paramètres de stockage du site.",
  'error.sceneInterrupted':
    'La scène a été interrompue. Veuillez actualiser et rouvrir.',
  'error.cannotReadOriginal':
    "Impossible de lire la photo d'origine. Veuillez en choisir une autre.",
  'error.photoReadFailed':
    "Impossible de lire la photo. La position n'a pas changé.",
  'error.exchangeBusy':
    'Veuillez patienter avant d’échanger des photos.',
  'error.swapFailed': 'L’échange a échoué. Veuillez réessayer.',
  'error.savingInProgress': 'Enregistrement en cours. Veuillez patienter.',
  'error.unsupportedFormat':
    'Veuillez choisir une photo JPG, PNG, WebP ou HEIC/HEIF.',
  'error.fileTooLarge': 'Veuillez choisir une photo de moins de 50 Mo.',
  'error.tooManyFiles':
    'Il reste {count} cadres vides. Veuillez choisir au plus {count} photos.',
  'error.invalidFile':
    "{name} n'est pas valide : choisissez une seule JPG, PNG, WebP ou HEIC/HEIF de moins de 50 Mo.",
  'error.savedButNotUpdated':
    "Les photos ont été enregistrées, mais la scène n'a pas fini de se mettre à jour. Veuillez rouvrir l'application.",
  'error.batchFailed':
    "{message} Aucune photo du lot n'a été accrochée.",
  'error.previewFailed':
    'Impossible de créer un aperçu de la photo. Veuillez réessayer.',
  'error.decodeFailed':
    'Impossible de décoder cette photo. Le format peut ne pas être pris en charge ou le fichier est corrompu. Réexportez-la en JPG ou PNG puis réessayez.',
  'error.heicTimeout':
    'Le traitement a pris trop de temps. Essayez une photo plus petite, ou exportez-la en JPG puis réessayez.',
  'error.heicConvert':
    'La conversion de la photo a échoué. Veuillez réessayer.',
  'error.heicWorker':
    'Impossible de démarrer la conversion HEIC. Actualisez la page ou essayez un autre navigateur.',
  'error.heicWorkerFailed':
    'Impossible de convertir cette photo HEIC pour le moment. Essayez une autre photo, ou exportez-la en JPG puis réessayez.',
  'error.storageOpen':
    "Impossible d'ouvrir le stockage local des photos. Vérifiez les paramètres de stockage du site dans votre navigateur.",
  'error.storageBlocked':
    'Le stockage des photos est occupé dans un autre onglet. Fermez l’autre onglet et réessayez.',
  'error.storageRead':
    'Impossible de lire les photos enregistrées. Veuillez actualiser et réessayer.',
  'error.storageSaveNoChange':
    "Impossible d'enregistrer la photo. La position n'a pas changé.",
  'error.storageFull':
    "Impossible d'enregistrer la photo. Le stockage est peut-être plein. Libérez de l'espace puis réessayez.",
  'batch.preparing': 'Préparation {current} / {total}…',
  'batch.saving': 'Enregistrement des photos…',
  'notice.batchUploaded':
    '{count} photos accrochées aléatoirement dans les cadres vides et enregistrées sur cet appareil.',
  'notice.photoAttached':
    'Photo accrochée à la position {number}. Enregistrée sur cet appareil.',
  'notice.photosSwapped':
    'Les photos {from} et {to} ont été échangées et enregistrées.',
  'notice.photoRemoved': 'Photo retirée. Cette position est à nouveau libre.',
  'notice.resumedSpinning':
    'Retour à la lampe entière, le carrousel continue de tourner.',
  'status.saving': 'Enregistrement…',
  'status.saveFailed':
    "L'enregistrement n'est pas terminé. Veuillez réessayer.",
  'credit.personalUse': 'Usage personnel et non commercial uniquement.',
  'action.hangPhoto': 'Ajouter une photo',
  'action.wind': 'Vent',
  'action.spin': 'Rotation',
  'action.pause': 'Pause',
  'action.turnOn': 'Allumer',
  'action.turnOff': 'Éteindre',
  'action.wholeLamp': 'Toute la lampe',
  'action.addPhoto': 'Ajouter une photo',
  'action.replaceAdjust': 'Remplacer / ajuster',
  'action.removePhoto': 'Retirer la photo',
  'action.choosePosition': 'Choisir un emplacement',
  'action.batchUpload': 'Import groupé',
  'action.music': 'Musique',
  'action.mute': 'Couper le son',
  'action.cancel': 'Annuler',
  'drag.hint': 'Glissez sur une autre photo pour échanger',
  'drag.releaseTo': 'Relâchez pour échanger vers {number}',
  'a11y.previous': 'Photo précédente',
  'a11y.next': 'Photo suivante',
  'a11y.captionInput': 'Légende d’humeur',
  'a11y.saveCaption': 'Enregistrer la légende',
  'a11y.clearCaption': 'Effacer la légende',
  'a11y.aiCaption': 'Générer une légende poétique avec l’IA',
  'action.aiCaption': 'Légende IA',
  'ai.captionGenerating': 'Une phrase poétique est en cours…',
  'ai.captionReady': 'Légende IA prête — modifiez-la puis enregistrez',
  'ai.captionFailed': 'Impossible de créer une légende — réessayez',
  'ai.captionRetry': 'Réessayer',
  'model.title': 'Modèle',
  'model.dashboardTitle': 'Modèle et usage',
  'model.default': 'Par défaut du serveur',
  'model.loading': 'Chargement des modèles…',
  'model.error': 'Impossible de charger la liste des modèles',
  'model.noModels': 'Aucun modèle configuré',
  'model.usageTitle': 'Utilisation des jetons',
  'model.noUsage': 'Aucun appel IA pour l’instant — accrochez une photo et le graphique se remplira.',
  'model.latest': 'Dernier : {tokens} jetons · {model}',
  'model.usageNote': 'L’usage est stocké sur cet appareil uniquement.',
  'model.close': 'Fermer',
  'a11y.modelButton': 'Réglages du modèle',
  'pony.thinking': 'Je rêve de faits festifs…',
  'pony.nudge': 'Psst — touche-moi pour une histoire de fête !',
  'pony.error': 'Impossible de joindre le conteur — touche pour réessayer.',
  'pony.retry': 'Réessayer',
  'pony.factsNote': 'Les faits festifs sont générés par IA.',
  'pony.factsNoteSearched': 'Fraîchement trouvé sur le web via Otari.',
  'a11y.pony': 'Poney du festival — touche pour des faits festifs',
  'ai.captionUnavailable':
    'Les légendes IA sont indisponibles pour le moment — vérifiez la configuration Otari puis réessayez',
  'theme.auto': 'Auto',
  'theme.default': 'Classique',
  'theme.new-year': "Jour de l'An",
  'theme.valentine': 'Saint-Valentin',
  'theme.spring-festival': 'Fête du Printemps',
  'theme.carnival': 'Carnaval',
  'theme.st-patrick': 'Saint-Patrick',
  'theme.april-fools': "Poisson d'avril",
  'theme.easter': 'Pâques',
  'theme.mothers-day': 'Fête des Mères',
  'theme.dragon-boat': 'Fête des Bateaux-Dragons',
  'theme.mid-autumn': 'Fête de la Mi-Automne',
  'theme.halloween': 'Halloween',
  'theme.diwali': 'Diwali',
  'theme.thanksgiving': 'Action de grâce',
  'theme.christmas': 'Noël',
  'a11y.themePicker': 'Choisir un thème de fête',
  'label.captionPlaceholder': 'Écrivez un petit mot…',
  'action.export': 'Exporter',
  'notice.exported': 'Polaroïd exporté',
  'error.emptyFrame': 'Ce cadre est vide — ajoutez d’abord une photo ou une légende',
  'a11y.resetView': 'Réinitialiser la vue',
  'a11y.musicOn': 'Couper la musique de fond',
  'a11y.musicOff': 'Lire la musique de fond',
  'a11y.choosePosition': 'Choisir la position de la photo',
  'a11y.closePicker': 'Fermer le sélecteur de position',
  'a11y.cropPreview': 'Aperçu de la photo recadrée',
  'a11y.scene':
    'Lampe carrousel 3D de photos rotative à glisser ; vous pouvez aussi utiliser les boutons ci-dessous pour choisir des photos',
  'label.photoCounter': 'Photo {number} / {total}',
  'dialog.uploadTitle': 'Accrochez vos photos',
  'dialog.uploadDesc':
    "{count} cadres vides restants. L'import groupé remplit les emplacements vides au hasard ; les photos existantes restent en place.",
  'dialog.framesFull':
    'Tous les cadres sont pleins. Touchez une photo pour la remplacer.',
  'dialog.batchHelp':
    'JPG, PNG, WebP, HEIC · 50 Mo max par photo · choisissez autant de photos qu’il y a de cadres vides',
  'picker.stepOne': 'Étape 1',
  'picker.title': 'Choisissez un emplacement pour votre photo',
  'picker.hint': 'Touchez une photo ci-dessous pour voir où elle s’accroche.',
  'picker.slotLabel': 'Choisir la position {number}',
  'picker.slotHasPhoto': ', contient votre photo',
  'picker.slotEmpty': ', emplacement vide',
  'picker.attached': ' · accrochée',
  'picker.hangAt': 'Accrocher à la position {number}',
  'picker.selectFirst': 'Choisissez d’abord un emplacement',
  'editor.title': 'Accrocher à la position {number}',
  'editor.description':
    'Choisissez une photo, ajustez le cadrage, puis accrochez ce moment. Les photos sont enregistrées uniquement dans ce navigateur et jamais téléversées.',
  'editor.convertingHeic': 'Conversion de la photo HEIC…',
  'editor.reading': 'Lecture de la photo…',
  'editor.pickPhoto': 'Choisissez une photo que vous aimez',
  'editor.chooseAnother': 'Choisir une autre photo',
  'editor.choosePhoto': 'Choisir une photo',
  'editor.formatHelp': 'JPG, PNG, WebP, HEIC/HEIF · 50 Mo max',
  'editor.convertingHeicNote':
    'Conversion de la photo HEIC. Les grandes photos peuvent prendre un instant…',
  'editor.zoom': 'Zoom',
  'editor.horizontal': 'Horizontal',
  'editor.vertical': 'Vertical',
  'editor.resetCrop': 'Réinitialiser le recadrage',
  'editor.preparing': 'Préparation…',
  'editor.confirm': 'Accrocher',
  'notFound.title': 'Erreur',
  'notFound.description':
    "La page a peut-être été supprimée ou n'existe pas. Veuillez vérifier l'adresse.",
  'notFound.backHome': 'Retour à l’accueil',
  'notFound.pageTitle': 'Page introuvable',
  'error.appCrashed':
    'Un problème est survenu. Veuillez actualiser la page et réessayer.',
  'lang.label': 'Langue',
  'lang.en': 'English',
  'lang.fr': 'Français',
  'lang.es': 'Español',
  'lang.zh': '中文',
};

const es: Entry = {
  'loading.starting': 'Encendiendo tu carrusel…',
  'error.sceneLoadFailed':
    'La escena no se cargó. Actualiza la página e inténtalo de nuevo.',
  'error.webglUnsupported':
    'Este navegador no puede mostrar la escena 3D. Activa la aceleración por hardware o prueba otro navegador.',
  'error.decorationLoad':
    'Una decoración no se cargó. Actualiza la página e inténtalo de nuevo.',
  'error.viewSave':
    'Este navegador no puede guardar la vista y el modo. Revisa la configuración de almacenamiento del sitio.',
  'error.sceneInterrupted':
    'La escena se interrumpió. Actualiza la página y vuelve a abrirla.',
  'error.cannotReadOriginal':
    'No se pudo leer la foto original. Elige otra.',
  'error.photoReadFailed': 'No se pudo leer la foto. La posición no cambió.',
  'error.exchangeBusy': 'Espera un momento antes de intercambiar fotos.',
  'error.swapFailed': 'El intercambio no funcionó. Inténtalo de nuevo.',
  'error.savingInProgress': 'Guardado en curso. Espera un momento.',
  'error.unsupportedFormat':
    'Elige una foto JPG, PNG, WebP o HEIC/HEIF.',
  'error.fileTooLarge': 'Elige una foto de menos de 50 MB.',
  'error.tooManyFiles':
    'Quedan {count} marcos vacíos. Elige como máximo {count} fotos.',
  'error.invalidFile':
    '{name} no es válido: elige una sola JPG, PNG, WebP o HEIC/HEIF de menos de 50 MB.',
  'error.savedButNotUpdated':
    'Las fotos se guardaron, pero la escena no terminó de actualizarse. Vuelve a abrir la aplicación.',
  'error.batchFailed': '{message} Ninguna foto del lote se colgó.',
  'error.previewFailed':
    'No se pudo crear la vista previa de la foto. Inténtalo de nuevo.',
  'error.decodeFailed':
    'No se pudo decodificar esta foto. El formato puede no ser compatible o el archivo está dañado. Reexpórtala como JPG o PNG e inténtalo de nuevo.',
  'error.heicTimeout':
    'El procesamiento tardó demasiado. Prueba una foto más pequeña o expórtala como JPG e inténtalo de nuevo.',
  'error.heicConvert': 'La conversión de la foto falló. Inténtalo de nuevo.',
  'error.heicWorker':
    'No se pudo iniciar la conversión HEIC. Actualiza la página o prueba otro navegador.',
  'error.heicWorkerFailed':
    'No se pudo convertir esta foto HEIC ahora mismo. Prueba otra foto o expórtala como JPG e inténtalo de nuevo.',
  'error.storageOpen':
    'No se pudo abrir el almacenamiento local de fotos. Revisa la configuración de almacenamiento del sitio en tu navegador.',
  'error.storageBlocked':
    'El almacenamiento de fotos está ocupado en otra pestaña. Cierra la otra pestaña e inténtalo de nuevo.',
  'error.storageRead':
    'No se pudieron leer las fotos guardadas. Actualiza la página e inténtalo de nuevo.',
  'error.storageSaveNoChange':
    'No se pudo guardar la foto. La posición no cambió.',
  'error.storageFull':
    'No se pudo guardar la foto. Es posible que el almacenamiento esté lleno. Libera espacio e inténtalo de nuevo.',
  'batch.preparing': 'Preparando {current} / {total}…',
  'batch.saving': 'Guardando fotos…',
  'notice.batchUploaded':
    '{count} fotos colgadas al azar en marcos vacíos y guardadas en este dispositivo.',
  'notice.photoAttached':
    'Foto colgada en la posición {number}. Guardada en este dispositivo.',
  'notice.photosSwapped':
    'Las fotos {from} y {to} se intercambiaron y guardaron.',
  'notice.photoRemoved': 'Foto retirada. Esta posición vuelve a estar libre.',
  'notice.resumedSpinning':
    'De vuelta a toda la lámpara, el carrusel sigue girando.',
  'status.saving': 'Guardando…',
  'status.saveFailed': 'El guardado no terminó. Inténtalo de nuevo.',
  'credit.personalUse': 'Solo para uso personal y no comercial.',
  'action.hangPhoto': 'Añadir foto',
  'action.wind': 'Viento',
  'action.spin': 'Girar',
  'action.pause': 'Pausa',
  'action.turnOn': 'Encender',
  'action.turnOff': 'Apagar',
  'action.wholeLamp': 'Toda la lámpara',
  'action.addPhoto': 'Añadir foto',
  'action.replaceAdjust': 'Reemplazar / ajustar',
  'action.removePhoto': 'Quitar foto',
  'action.choosePosition': 'Elegir un lugar',
  'action.batchUpload': 'Subida masiva',
  'action.music': 'Música',
  'action.mute': 'Silenciar',
  'action.cancel': 'Cancelar',
  'drag.hint': 'Arrastra sobre otra foto para intercambiar',
  'drag.releaseTo': 'Suelta para intercambiar con {number}',
  'a11y.previous': 'Foto anterior',
  'a11y.next': 'Foto siguiente',
  'a11y.captionInput': 'Frase de ánimo',
  'a11y.saveCaption': 'Guardar frase',
  'a11y.clearCaption': 'Borrar frase',
  'a11y.aiCaption': 'Generar una frase poética con IA',
  'action.aiCaption': 'Frase IA',
  'ai.captionGenerating': 'Soñando una frase…',
  'ai.captionReady': 'Frase lista — edítala y luego guarda',
  'ai.captionFailed': 'No se pudo crear la frase — inténtalo de nuevo',
  'ai.captionRetry': 'Reintentar',
  'model.title': 'Modelo',
  'model.dashboardTitle': 'Modelo y uso',
  'model.default': 'Predeterminado del servidor',
  'model.loading': 'Cargando modelos…',
  'model.error': 'No se pudo cargar la lista de modelos',
  'model.noModels': 'Aún no hay modelos configurados',
  'model.usageTitle': 'Uso de tokens',
  'model.noUsage': 'Aún no hay llamadas de IA: cuelga una foto y el gráfico se llenará.',
  'model.latest': 'Última: {tokens} tokens · {model}',
  'model.usageNote': 'El uso se guarda solo en este dispositivo.',
  'model.close': 'Cerrar',
  'a11y.modelButton': 'Ajustes del modelo',
  'pony.thinking': 'Soñando datos del festival…',
  'pony.nudge': 'Psst: ¡tócame para una historia del festival!',
  'pony.error': 'No se pudo contactar al narrador: toca para reintentarlo.',
  'pony.retry': 'Reintentar',
  'pony.factsNote': 'Los datos del festival son generados por IA.',
  'pony.factsNoteSearched': 'Recién buscado en la web con Otari.',
  'a11y.pony': 'Poni del festival: toca para datos del festival',
  'ai.captionUnavailable':
    'Las frases IA no están disponibles ahora mismo — revisa la configuración de Otari e inténtalo de nuevo',
  'theme.auto': 'Auto',
  'theme.default': 'Clásico',
  'theme.new-year': 'Año Nuevo',
  'theme.valentine': 'Día de San Valentín',
  'theme.spring-festival': 'Festival de Primavera',
  'theme.carnival': 'Carnaval',
  'theme.st-patrick': 'Día de San Patricio',
  'theme.april-fools': 'Día de los Inocentes',
  'theme.easter': 'Pascua',
  'theme.mothers-day': 'Día de la Madre',
  'theme.dragon-boat': 'Festival del Barco Dragón',
  'theme.mid-autumn': 'Festival del Medio Otoño',
  'theme.halloween': 'Halloween',
  'theme.diwali': 'Diwali',
  'theme.thanksgiving': 'Acción de Gracias',
  'theme.christmas': 'Navidad',
  'a11y.themePicker': 'Elegir un tema festivo',
  'label.captionPlaceholder': 'Escribe una frase…',
  'action.export': 'Exportar',
  'notice.exported': 'Polaroid exportada',
  'error.emptyFrame': 'Este marco está vacío: añade una foto o una frase primero',
  'a11y.resetView': 'Restablecer vista',
  'a11y.musicOn': 'Silenciar la música de fondo',
  'a11y.musicOff': 'Reproducir la música de fondo',
  'a11y.choosePosition': 'Elegir la posición de la foto',
  'a11y.closePicker': 'Cerrar selector de posición',
  'a11y.cropPreview': 'Vista previa de la foto recortada',
  'a11y.scene':
    'Lámpara carrusel 3D de fotos giratoria; también puedes usar los botones de abajo para elegir fotos',
  'label.photoCounter': 'Foto {number} / {total}',
  'dialog.uploadTitle': 'Coloca tus fotos',
  'dialog.uploadDesc':
    'Quedan {count} marcos vacíos. La subida masiva llena los lugares vacíos al azar; las fotos existentes permanecen en su sitio.',
  'dialog.framesFull':
    'Todos los marcos están llenos. Toca una foto para reemplazarla.',
  'dialog.batchHelp':
    'JPG, PNG, WebP, HEIC · máx. 50 MB por foto · elige tantas fotos como marcos vacíos haya',
  'picker.stepOne': 'Paso 1',
  'picker.title': 'Elige un lugar para tu foto',
  'picker.hint': 'Toca una foto de abajo para ver dónde se colga.',
  'picker.slotLabel': 'Elegir la posición {number}',
  'picker.slotHasPhoto': ', tiene tu foto',
  'picker.slotEmpty': ', lugar vacío',
  'picker.attached': ' · colgada',
  'picker.hangAt': 'Colgar en la posición {number}',
  'picker.selectFirst': 'Elige primero un lugar',
  'editor.title': 'Colgar en la posición {number}',
  'editor.description':
    'Elige una foto, ajusta el encuadre y colga este momento. Las fotos se guardan solo en este navegador y nunca se suben.',
  'editor.convertingHeic': 'Convirtiendo foto HEIC…',
  'editor.reading': 'Leyendo foto…',
  'editor.pickPhoto': 'Elige una foto que te guste',
  'editor.chooseAnother': 'Elegir otra foto',
  'editor.choosePhoto': 'Elegir una foto',
  'editor.formatHelp': 'JPG, PNG, WebP, HEIC/HEIF · máx. 50 MB',
  'editor.convertingHeicNote':
    'Convirtiendo foto HEIC. Las fotos grandes pueden tardar un momento…',
  'editor.zoom': 'Zoom',
  'editor.horizontal': 'Horizontal',
  'editor.vertical': 'Vertical',
  'editor.resetCrop': 'Restablecer recorte',
  'editor.preparing': 'Preparando…',
  'editor.confirm': 'Colgarla',
  'notFound.title': 'Error',
  'notFound.description':
    'La página pudo haber sido eliminada o no existe. Comprueba la dirección.',
  'notFound.backHome': 'Volver al inicio',
  'notFound.pageTitle': 'Página no encontrada',
  'error.appCrashed':
    'Algo salió mal. Actualiza la página e inténtalo de nuevo.',
  'lang.label': 'Idioma',
  'lang.en': 'English',
  'lang.fr': 'Français',
  'lang.es': 'Español',
  'lang.zh': '中文',
};

const zh: Entry = {
  'loading.starting': '正在点亮你的旋转木马…',
  'error.sceneLoadFailed': '画面暂时没加载成功，请刷新重试。',
  'error.webglUnsupported':
    '这个浏览器暂时无法显示 3D 场景，请开启硬件加速或换一个浏览器。',
  'error.decorationLoad': '有一处装饰暂时没加载出来，请刷新重试。',
  'error.viewSave': '当前浏览器无法保存视角和模式，请检查网站存储设置。',
  'error.sceneInterrupted': '画面暂时中断，请刷新页面重新打开。',
  'error.cannotReadOriginal': '原相片无法读取，请重新选择。',
  'error.photoReadFailed': '相片读取失败，位置没有改变。',
  'error.exchangeBusy': '请稍后再交换相片。',
  'error.swapFailed': '交换没有成功，请重试。',
  'error.savingInProgress': '正在保存，请稍候。',
  'error.unsupportedFormat': '请选择 JPG、PNG、WebP 或 HEIC/HEIF 格式的相片。',
  'error.fileTooLarge': '请选择 50 MB 以内的相片。',
  'error.tooManyFiles': '还有 {count} 个空相框，请最多选择 {count} 张照片。',
  'error.invalidFile':
    '{name} 不符合要求：请选择单张不超过 50 MB 的 JPG、PNG、WebP 或 HEIC/HEIF。',
  'error.savedButNotUpdated': '照片已保存，但画面更新未完成，请重新打开小工具。',
  'error.batchFailed': '{message} 本次批量照片均未挂上。',
  'error.previewFailed': '无法生成相片预览，请重试。',
  'error.decodeFailed':
    '这张相片无法解码，可能格式不受支持或文件已损坏。请重新导出为 JPG 或 PNG 后再试。',
  'error.heicTimeout': '相片处理时间较长，请换一张较小的相片，或导出为 JPG 后重试。',
  'error.heicConvert': '相片转换失败，请重试。',
  'error.heicWorker': '无法启动 HEIC 转换，请刷新页面或换一个浏览器重试。',
  'error.heicWorkerFailed':
    '这张 HEIC 相片暂时无法转换。请尝试其他相片，或导出为 JPG 后重试。',
  'error.storageOpen': '无法打开本机相片存储，请检查浏览器的网站存储设置。',
  'error.storageBlocked': '相片存储暂时被其他页面占用，请关闭其他页面后重试。',
  'error.storageRead': '未能读取本机保存的相片，请刷新重试。',
  'error.storageSaveNoChange': '相片未能保存，位置没有改变。',
  'error.storageFull': '相片未能保存到本机，可能存储空间不足。请释放空间后重试。',
  'batch.preparing': '正在准备 {current} / {total} 张…',
  'batch.saving': '正在保存相片…',
  'notice.batchUploaded': '已将 {count} 张照片随机挂入空相框，并保存到本机。',
  'notice.photoAttached': '相片已挂在 {number} 号位置，已自动保存到本机。',
  'notice.photosSwapped': '{from} 与 {to} 号相片已交换，已自动保存。',
  'notice.photoRemoved': '相片已取下，这个位置可以重新挂相片。',
  'notice.resumedSpinning': '回到整盏灯后，木马会继续旋转。',
  'status.saving': '正在保存…',
  'status.saveFailed': '保存未完成，请重试',
  'credit.personalUse': '仅供个人非商业使用。',
  'action.hangPhoto': '挂相片',
  'action.wind': '起风',
  'action.spin': '旋转',
  'action.pause': '暂停',
  'action.turnOn': '开灯',
  'action.turnOff': '关灯',
  'action.wholeLamp': '整盏灯',
  'action.addPhoto': '放入相片',
  'action.replaceAdjust': '更换 / 调整',
  'action.removePhoto': '取下相片',
  'action.choosePosition': '选位置挂一张',
  'action.batchUpload': '批量上传',
  'action.music': '音乐',
  'action.mute': '静音',
  'action.cancel': '取消',
  'drag.hint': '拖到另一张相片上交换',
  'drag.releaseTo': '松手交换到 {number} 号',
  'a11y.previous': '上一张相片',
  'a11y.next': '下一张相片',
  'a11y.captionInput': '心情短句',
  'a11y.saveCaption': '保存短句',
  'a11y.clearCaption': '清空短句',
  'a11y.aiCaption': '用 AI 生成一句诗意短句',
  'action.aiCaption': 'AI 写一句',
  'ai.captionGenerating': '正在想一句…',
  'ai.captionReady': 'AI 短句已生成，改好后点保存',
  'ai.captionFailed': '没能生成短句，再试一次',
  'ai.captionRetry': '重试',
  'model.title': '模型',
  'model.dashboardTitle': '模型与用量',
  'model.default': '服务器默认',
  'model.loading': '正在加载模型…',
  'model.error': '无法加载模型列表',
  'model.noModels': '尚未配置模型',
  'model.usageTitle': 'Token 用量',
  'model.noUsage': '还没有 AI 调用——挂上一张照片，图表就会出现。',
  'model.latest': '最近：{tokens} tokens · {model}',
  'model.usageNote': '用量仅保存在本设备上。',
  'model.close': '关闭',
  'a11y.modelButton': '模型设置',
  'pony.thinking': '正在想节日小知识…',
  'pony.nudge': '嘘——点我听节日小故事！',
  'pony.error': '没能联系上节日讲故事的人——点一下再试一次。',
  'pony.retry': '重试',
  'pony.factsNote': '节日小知识由 AI 生成。',
  'pony.factsNoteSearched': '来自 Otari 实时联网搜索。',
  'a11y.pony': '节日小马——点我听节日小知识',
  'ai.captionUnavailable': 'AI 短句暂时不可用，请检查 Otari 配置后再试',
  'theme.auto': '自动',
  'theme.default': '经典游园',
  'theme.new-year': '元旦',
  'theme.valentine': '情人节',
  'theme.spring-festival': '春节',
  'theme.carnival': '狂欢节',
  'theme.st-patrick': '圣帕特里克节',
  'theme.april-fools': '愚人节',
  'theme.easter': '复活节',
  'theme.mothers-day': '母亲节',
  'theme.dragon-boat': '端午节',
  'theme.mid-autumn': '中秋节',
  'theme.halloween': '万圣节',
  'theme.diwali': '排灯节',
  'theme.thanksgiving': '感恩节',
  'theme.christmas': '圣诞节',
  'a11y.themePicker': '选择节日主题',
  'label.captionPlaceholder': '写一句心情短句…',
  'action.export': '导出',
  'notice.exported': '已导出拍立得图片',
  'error.emptyFrame': '当前相框为空，请先放入相片或输入心情短句',
  'a11y.resetView': '重置视角',
  'a11y.musicOn': '静音背景音乐',
  'a11y.musicOff': '播放背景音乐',
  'a11y.choosePosition': '选择相片位置',
  'a11y.closePicker': '关闭位置选择',
  'a11y.cropPreview': '裁剪后的相片预览',
  'a11y.scene': '可拖动旋转的三维相片旋转木马灯；也可使用下方按钮选择相片',
  'label.photoCounter': '相片 {number} / {total}',
  'dialog.uploadTitle': '挂上你的相片',
  'dialog.uploadDesc': '还有 {count} 个空相框。批量上传会随机填入空位，已有照片保持原位。',
  'dialog.framesFull': '相框已挂满，可以点击照片更换。',
  'dialog.batchHelp':
    'JPG、PNG、WebP、HEIC · 单张最大 50 MB · 最多选择剩余空位数量的照片',
  'picker.stepOne': '第一步',
  'picker.title': '给相片选个位置',
  'picker.hint': '点击下面的相片，看看它挂在哪里。',
  'picker.slotLabel': '选择 {number} 号相片位置',
  'picker.slotHasPhoto': '，已有你的相片',
  'picker.slotEmpty': '，空位置',
  'picker.attached': ' · 已挂',
  'picker.hangAt': '挂在 {number} 号位置',
  'picker.selectFirst': '先选一个位置',
  'editor.title': '挂在 {number} 号位置',
  'editor.description':
    '选择相片，调整画面，再把这一刻挂起来。相片仅保存在此浏览器，不会上传到服务器。',
  'editor.convertingHeic': '正在转换 HEIC 相片…',
  'editor.reading': '正在读取相片…',
  'editor.pickPhoto': '选一张喜欢的相片',
  'editor.chooseAnother': '选择另一张相片',
  'editor.choosePhoto': '选择相片',
  'editor.formatHelp': 'JPG、PNG、WebP、HEIC/HEIF · 最大 50 MB',
  'editor.convertingHeicNote': '正在转换 HEIC 相片，较大的照片可能需要一些时间…',
  'editor.zoom': '放大画面',
  'editor.horizontal': '左右位置',
  'editor.vertical': '上下位置',
  'editor.resetCrop': '重置裁剪',
  'editor.preparing': '正在准备…',
  'editor.confirm': '确认挂上',
  'notFound.title': '错误',
  'notFound.description': '页面可能已被删除或不存在，请检查网址是否正确。',
  'notFound.backHome': '返回首页',
  'notFound.pageTitle': '页面未找到',
  'error.appCrashed': '应用发生错误，请刷新页面重试',
  'lang.label': '语言',
  'lang.en': 'English',
  'lang.fr': 'Français',
  'lang.es': 'Español',
  'lang.zh': '中文',
};

const dictionaries: Record<Locale, Entry> = { en, fr, es, zh };

let currentLocale: Locale = DEFAULT_LOCALE;

function readStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (SUPPORTED_LOCALES as readonly string[]).includes(stored))
      return stored as Locale;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

currentLocale = readStoredLocale();

function applyHtmlLang(locale: Locale) {
  if (typeof document !== 'undefined')
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : locale;
}

applyHtmlLang(currentLocale);

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale) {
  currentLocale = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
  applyHtmlLang(locale);
}

export function translate(
  key: string,
  params?: Record<string, string | number>,
): string {
  const table = dictionaries[currentLocale] ?? dictionaries.en;
  let text = table[key] ?? dictionaries.en[key] ?? key;
  if (params)
    for (const [name, value] of Object.entries(params))
      text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
  return text;
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getLocale());
  const changeLocale = useCallback((next: Locale) => {
    setLocale(next);
    setLocaleState(next);
  }, []);
  const t = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translate(key, params),
    [],
  );
  return (
    <I18nContext.Provider value={{ locale, setLocale: changeLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
