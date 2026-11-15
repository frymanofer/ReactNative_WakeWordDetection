import type { AppLanguage } from './appflow';

/** Spoken onboarding copy. Keep every language complete: these strings are
 * played by the language-specific TTS model selected at app startup. */
export type NarrationCopy = {
  wakeWordDetected: (wakeWord: string) => string;
  modeSelection: string;
  cloningChoices: (hasClonedVoices: boolean) => string;
  introduction: (voice: string) => string[];
  selectedVoice: (voice: string) => string;
  speakerVerificationSetup: string;
  speakerVerificationSkipped: string;
  speakerVerificationReady: string;
  sayWakeWord: (wakeWords: string) => string;
  cloneCreated: (voice: string) => string;
};

const NARRATION: Record<AppLanguage, NarrationCopy> = {
  en: {
    wakeWordDetected: (wakeWord) => `${wakeWord} detected.`,
    modeSelection:
      'You can now explore the voice features in five different ways. Choose Local AI Chat, which runs entirely on this device; Full AI Chat, which uses remote Gemini; or test speech recognition and speech synthesis separately, or combine them.',
    cloningChoices: (hasClonedVoices) =>
      hasClonedVoices
        ? 'You can clone a new voice, choose one of your existing cloned voices, or select a built-in voice.'
        : 'You can clone a new voice or select a built-in voice.',
    introduction: (voice) => [
      `Hello. My name is ${voice}. In this app, I will use my cloned voice to demonstrate the capabilities of our voice AI agent.`,
      'I will be your personal guide and walk you through this demonstration step by step.',
      'First, choose the voice you would like to use.',
    ],
    selectedVoice: (voice) => `You selected ${voice}.`,
    speakerVerificationSetup:
      'The next step is speaker verification. You can create a new speaker signature, use a saved signature, or skip this step.',
    speakerVerificationSkipped: 'Speaker verification was skipped.',
    speakerVerificationReady: 'Speaker verification is ready!',
    sayWakeWord: (wakeWords) => `Now say the wake word ${wakeWords} to continue.`,
    cloneCreated: (voice) => `Hello! I am ${voice}. This is my new cloned voice.`,
  },
  'pt-BR': {
    wakeWordDetected: (wakeWord) => `${wakeWord} detectado.`,
    modeSelection:
      'Agora você pode explorar os recursos de voz de cinco maneiras diferentes. Escolha o Chat de IA local, que funciona inteiramente neste dispositivo; o Chat de IA completo, que usa o Gemini remoto; ou teste o reconhecimento e a síntese de voz separadamente, ou combine os dois.',
    cloningChoices: (hasClonedVoices) =>
      hasClonedVoices
        ? 'Você pode clonar uma nova voz, selecionar uma das suas vozes clonadas ou escolher uma voz integrada.'
        : 'Você pode clonar uma nova voz ou escolher uma voz integrada.',
    introduction: (voice) => [
      `Olá. Meu nome é ${voice}. Neste aplicativo, usarei minha voz clonada para demonstrar os recursos do nosso agente de IA por voz.`,
      'Serei seu guia pessoal e conduzirei você passo a passo por esta demonstração.',
      'Primeiro, escolha a voz que você deseja usar.',
    ],
    selectedVoice: (voice) => `Você selecionou ${voice}.`,
    speakerVerificationSetup:
      'A próxima etapa é configurar a verificação do locutor. Você pode criar uma nova assinatura de voz, usar uma assinatura salva ou pular esta etapa.',
    speakerVerificationSkipped: 'A verificação do locutor foi ignorada.',
    speakerVerificationReady: 'A verificação do locutor está pronta!',
    sayWakeWord: (wakeWords) => `Agora diga a palavra de ativação ${wakeWords} para continuar.`,
    cloneCreated: (voice) => `Olá! Eu sou ${voice}. Esta é a minha nova voz clonada.`,
  },
  'pt-PT': {
    wakeWordDetected: (wakeWord) => `${wakeWord} detetado.`,
    modeSelection:
      'Agora pode explorar as funcionalidades de voz de cinco formas diferentes. Escolha o Chat de IA local, que funciona inteiramente neste dispositivo; o Chat de IA completo, que usa o Gemini remoto; ou teste o reconhecimento e a síntese de voz em separado, ou combine os dois.',
    cloningChoices: (hasClonedVoices) =>
      hasClonedVoices
        ? 'Pode clonar uma nova voz, selecionar uma das suas vozes clonadas ou escolher uma voz integrada.'
        : 'Pode clonar uma nova voz ou escolher uma voz integrada.',
    introduction: (voice) => [
      `Olá. O meu nome é ${voice}. Nesta aplicação, vou usar a minha voz clonada para demonstrar as capacidades do nosso agente de IA por voz.`,
      'Serei o seu guia pessoal e vou acompanhá-lo passo a passo nesta demonstração.',
      'Primeiro, escolha a voz que pretende usar.',
    ],
    selectedVoice: (voice) => `Selecionou ${voice}.`,
    speakerVerificationSetup:
      'O passo seguinte é configurar a verificação do orador. Pode criar uma nova assinatura de voz, usar uma assinatura guardada ou saltar este passo.',
    speakerVerificationSkipped: 'A verificação do orador foi ignorada.',
    speakerVerificationReady: 'A verificação do orador está pronta!',
    sayWakeWord: (wakeWords) => `Agora diga a palavra de ativação ${wakeWords} para continuar.`,
    cloneCreated: (voice) => `Olá! Eu sou ${voice}. Esta é a minha nova voz clonada.`,
  },
  de: {
    wakeWordDetected: (wakeWord) => `${wakeWord} erkannt.`,
    modeSelection:
      'Jetzt kannst du die Sprachfunktionen auf fünf verschiedene Arten ausprobieren. Wähle den lokalen KI-Chat, der vollständig auf diesem Gerät läuft, den vollständigen KI-Chat mit dem entfernten Gemini-Dienst oder teste Spracherkennung und Sprachsynthese einzeln oder gemeinsam.',
    cloningChoices: (hasClonedVoices) =>
      hasClonedVoices
        ? 'Du kannst eine neue Stimme klonen, eine deiner bereits geklonten Stimmen auswählen oder eine integrierte Stimme verwenden.'
        : 'Du kannst eine neue Stimme klonen oder eine integrierte Stimme verwenden.',
    introduction: (voice) => [
      `Hallo. Ich heiße ${voice}. In dieser App verwende ich meine geklonte Stimme, um die Möglichkeiten unseres Sprach-KI-Agenten zu demonstrieren.`,
      'Ich begleite dich als persönlicher Guide Schritt für Schritt durch diese Demonstration.',
      'Wähle zuerst die Stimme aus, die du verwenden möchtest.',
    ],
    selectedVoice: (voice) => `Du hast ${voice} ausgewählt.`,
    speakerVerificationSetup:
      'Als Nächstes richten wir die Sprecherverifizierung ein. Du kannst ein neues Sprecherprofil erstellen, ein gespeichertes Profil verwenden oder diesen Schritt überspringen.',
    speakerVerificationSkipped: 'Die Sprecherverifizierung wurde übersprungen.',
    speakerVerificationReady: 'Die Sprecherverifizierung ist bereit!',
    sayWakeWord: (wakeWords) => `Sage jetzt das Aktivierungswort ${wakeWords}, um fortzufahren.`,
    cloneCreated: (voice) => `Hallo! Ich bin ${voice}. Das ist meine neue geklonte Stimme.`,
  },
  es: {
    wakeWordDetected: (wakeWord) => `${wakeWord} detectado.`,
    modeSelection:
      'Ahora puedes probar las funciones de voz de cinco maneras diferentes. Elige el chat de IA local, que funciona completamente en este dispositivo; el chat de IA completo, que utiliza Gemini de forma remota; o prueba por separado el reconocimiento y la síntesis de voz, o combina ambos.',
    cloningChoices: (hasClonedVoices) =>
      hasClonedVoices
        ? 'Puedes clonar una voz nueva, seleccionar una de tus voces clonadas o elegir una voz integrada.'
        : 'Puedes clonar una voz nueva o elegir una voz integrada.',
    introduction: (voice) => [
      `Hola. Me llamo ${voice}. En esta aplicación utilizaré mi voz clonada para mostrar las capacidades de nuestro agente de IA por voz.`,
      'Seré tu guía personal y te acompañaré paso a paso durante esta demostración.',
      'Primero, elige la voz que quieres utilizar.',
    ],
    selectedVoice: (voice) => `Has seleccionado ${voice}.`,
    speakerVerificationSetup:
      'El siguiente paso es configurar la verificación del hablante. Puedes crear un nuevo perfil de voz, utilizar un perfil guardado u omitir este paso.',
    speakerVerificationSkipped: 'Se ha omitido la verificación del hablante.',
    speakerVerificationReady: '¡La verificación del hablante está lista!',
    sayWakeWord: (wakeWords) => `Ahora di la palabra de activación ${wakeWords} para continuar.`,
    cloneCreated: (voice) => `¡Hola! Soy ${voice}. Esta es mi nueva voz clonada.`,
  },
  fr: {
    wakeWordDetected: (wakeWord) => `${wakeWord} détecté.`,
    modeSelection:
      'Vous pouvez maintenant découvrir les fonctionnalités vocales de cinq façons différentes. Choisissez le chat avec l’IA locale, qui fonctionne entièrement sur cet appareil ; le chat complet avec l’IA, qui utilise Gemini à distance ; ou testez séparément la reconnaissance et la synthèse vocales, ou combinez-les.',
    cloningChoices: (hasClonedVoices) =>
      hasClonedVoices
        ? 'Vous pouvez cloner une nouvelle voix, sélectionner l’une de vos voix clonées ou choisir une voix intégrée.'
        : 'Vous pouvez cloner une nouvelle voix ou choisir une voix intégrée.',
    introduction: (voice) => [
      `Bonjour. Je m’appelle ${voice}. Dans cette application, j’utiliserai ma voix clonée pour vous présenter les capacités de notre agent d’IA vocale.`,
      'Je serai votre guide personnel et vous accompagnerai pas à pas tout au long de cette démonstration.',
      'Commencez par choisir la voix que vous souhaitez utiliser.',
    ],
    selectedVoice: (voice) => `Vous avez choisi ${voice}.`,
    speakerVerificationSetup:
      'L’étape suivante consiste à configurer la vérification du locuteur. Vous pouvez créer une nouvelle empreinte vocale, utiliser une empreinte enregistrée ou passer cette étape.',
    speakerVerificationSkipped: 'La vérification du locuteur a été ignorée.',
    speakerVerificationReady: 'La vérification du locuteur est prête !',
    sayWakeWord: (wakeWords) => `Dites maintenant le mot d’activation ${wakeWords} pour continuer.`,
    cloneCreated: (voice) => `Bonjour ! Je suis ${voice}. Voici ma nouvelle voix clonée.`,
  },
  it: {
    wakeWordDetected: (wakeWord) => `${wakeWord} rilevato.`,
    modeSelection:
      'Ora puoi provare le funzioni vocali in cinque modi diversi. Scegli la chat con l’IA locale, che funziona interamente su questo dispositivo; la chat completa con l’IA, che usa Gemini da remoto; oppure prova separatamente il riconoscimento e la sintesi vocale, o usali insieme.',
    cloningChoices: (hasClonedVoices) =>
      hasClonedVoices
        ? 'Puoi clonare una nuova voce, selezionare una delle tue voci clonate o scegliere una voce integrata.'
        : 'Puoi clonare una nuova voce o scegliere una voce integrata.',
    introduction: (voice) => [
      `Ciao. Mi chiamo ${voice}. In questa applicazione userò la mia voce clonata per mostrarti le funzionalità del nostro agente IA vocale.`,
      'Sarò la tua guida personale e ti accompagnerò passo dopo passo durante questa dimostrazione.',
      'Per prima cosa, scegli la voce che vuoi usare.',
    ],
    selectedVoice: (voice) => `Hai selezionato ${voice}.`,
    speakerVerificationSetup:
      'Il prossimo passaggio consiste nel configurare la verifica del parlante. Puoi creare una nuova impronta vocale, usare un’impronta salvata oppure saltare questo passaggio.',
    speakerVerificationSkipped: 'La verifica del parlante è stata saltata.',
    speakerVerificationReady: 'La verifica del parlante è pronta!',
    sayWakeWord: (wakeWords) => `Ora pronuncia la parola di attivazione ${wakeWords} per continuare.`,
    cloneCreated: (voice) => `Ciao! Sono ${voice}. Questa è la mia nuova voce clonata.`,
  },
  nl: {
    wakeWordDetected: (wakeWord) => `${wakeWord} gedetecteerd.`,
    modeSelection:
      'Je kunt de spraakfuncties nu op vijf verschillende manieren uitproberen. Kies Lokale AI-chat, die volledig op dit apparaat werkt; Volledige AI-chat, die Gemini op afstand gebruikt; of test spraakherkenning en spraaksynthese afzonderlijk, of combineer ze.',
    cloningChoices: (hasClonedVoices) =>
      hasClonedVoices
        ? 'Je kunt een nieuwe stem klonen, een van je bestaande gekloonde stemmen kiezen of een ingebouwde stem selecteren.'
        : 'Je kunt een nieuwe stem klonen of een ingebouwde stem selecteren.',
    introduction: (voice) => [
      `Hallo. Ik heet ${voice}. In deze app gebruik ik mijn gekloonde stem om de mogelijkheden van onze spraakgestuurde AI-agent te demonstreren.`,
      'Ik ben je persoonlijke gids en begeleid je stap voor stap door deze demonstratie.',
      'Kies eerst de stem die je wilt gebruiken.',
    ],
    selectedVoice: (voice) => `Je hebt ${voice} geselecteerd.`,
    speakerVerificationSetup:
      'De volgende stap is het instellen van sprekerverificatie. Je kunt een nieuw stemprofiel maken, een opgeslagen profiel gebruiken of deze stap overslaan.',
    speakerVerificationSkipped: 'Sprekerverificatie is overgeslagen.',
    speakerVerificationReady: 'Sprekerverificatie is klaar!',
    sayWakeWord: (wakeWords) => `Zeg nu het activeringswoord ${wakeWords} om door te gaan.`,
    cloneCreated: (voice) => `Hallo! Ik ben ${voice}. Dit is mijn nieuwe gekloonde stem.`,
  },
  he: {
    wakeWordDetected: (wakeWord) => `${wakeWord} זוהה.`,
    modeSelection:
      'עכשיו אפשר לנסות את יכולות הקול בחמש דרכים שונות. בחרו שיחה עם בינה מלאכותית מקומית, שפועלת כולה במכשיר הזה; שיחה מלאה עם בינה מלאכותית, שמשתמשת במודל Gemini המרוחק; או נסו זיהוי דיבור והקראת טקסט בנפרד, או את שניהם יחד.',
    cloningChoices: (hasClonedVoices) =>
      hasClonedVoices
        ? 'אפשר לשכפל קול חדש, לבחור אחד מהקולות המשוכפלים שלכם, או לבחור קול מובנה.'
        : 'אפשר לשכפל קול חדש או לבחור קול מובנה.',
    introduction: (voice) => [
      `שלום. קוראים לי ${voice}. באפליקציה הזאת אשתמש בקול המשוכפל שלי כדי להדגים את היכולות של סוכן הבינה המלאכותית הקולי שלנו.`,
      'אני אהיה המדריך האישי שלכם ואלווה אתכם שלב אחר שלב בהדגמה הזאת.',
      'קודם כול, בחרו את הקול שתרצו להשתמש בו.',
    ],
    selectedVoice: (voice) => `בחרתם בקול של ${voice}.`,
    speakerVerificationSetup:
      'השלב הבא הוא הגדרת אימות דובר. אפשר ליצור חתימה קולית חדשה, להשתמש בחתימה שמורה, או לדלג על השלב הזה.',
    speakerVerificationSkipped: 'דילגתם על אימות הדובר.',
    speakerVerificationReady: 'אימות הדובר מוכן!',
    sayWakeWord: (wakeWords) => `עכשיו אמרו את מילת ההפעלה ${wakeWords} כדי להמשיך.`,
    cloneCreated: (voice) => `שלום! אני ${voice}. זה הקול המשוכפל החדש שלי.`,
  },
  da: {
    wakeWordDetected: (wakeWord) => `${wakeWord} registreret.`,
    modeSelection:
      'Nu kan du prøve stemmefunktionerne på fem forskellige måder. Vælg lokal AI-chat, der kører helt på denne enhed; fuld AI-chat, der bruger den eksterne Gemini-model; eller prøv talegenkendelse og oplæsning hver for sig eller sammen.',
    cloningChoices: (hasClonedVoices) =>
      hasClonedVoices
        ? 'Du kan klone en ny stemme, vælge en af dine klonede stemmer eller vælge en indbygget stemme.'
        : 'Du kan klone en ny stemme eller vælge en indbygget stemme.',
    introduction: (voice) => [
      `Hej. Jeg hedder ${voice}. I denne app bruger jeg min klonede stemme til at vise, hvad vores stemmestyrede AI-agent kan.`,
      'Jeg er din personlige guide og fører dig trin for trin gennem denne demonstration.',
      'Vælg først den stemme, du vil bruge.',
    ],
    selectedVoice: (voice) => `Du har valgt ${voice}.`,
    speakerVerificationSetup:
      'Næste trin er at konfigurere talerverifikation. Du kan oprette et nyt stemmeaftryk, bruge et gemt aftryk eller springe dette trin over.',
    speakerVerificationSkipped: 'Talerverifikation er sprunget over.',
    speakerVerificationReady: 'Talerverifikation er klar!',
    sayWakeWord: (wakeWords) => `Sig nu aktiveringsordet ${wakeWords} for at fortsætte.`,
    cloneCreated: (voice) => `Hej! Jeg er ${voice}. Dette er min nye klonede stemme.`,
  },
  sv: {
    wakeWordDetected: (wakeWord) => `${wakeWord} upptäckt.`,
    modeSelection:
      'Nu kan du prova röstfunktionerna på fem olika sätt. Välj lokal AI-chatt, som körs helt på den här enheten; fullständig AI-chatt, som använder fjärrmodellen Gemini; eller prova taligenkänning och uppläsning var för sig eller tillsammans.',
    cloningChoices: (hasClonedVoices) =>
      hasClonedVoices
        ? 'Du kan klona en ny röst, välja en av dina klonade röster eller välja en inbyggd röst.'
        : 'Du kan klona en ny röst eller välja en inbyggd röst.',
    introduction: (voice) => [
      `Hej. Jag heter ${voice}. I den här appen använder jag min klonade röst för att visa vad vår röststyrda AI-agent kan.`,
      'Jag är din personliga guide och tar dig steg för steg genom den här demonstrationen.',
      'Välj först den röst du vill använda.',
    ],
    selectedVoice: (voice) => `Du har valt ${voice}.`,
    speakerVerificationSetup:
      'Nästa steg är att ställa in talarverifiering. Du kan skapa ett nytt röstavtryck, använda ett sparat avtryck eller hoppa över det här steget.',
    speakerVerificationSkipped: 'Talarverifieringen hoppades över.',
    speakerVerificationReady: 'Talarverifieringen är klar!',
    sayWakeWord: (wakeWords) => `Säg nu aktiveringsordet ${wakeWords} för att fortsätta.`,
    cloneCreated: (voice) => `Hej! Jag är ${voice}. Det här är min nya klonade röst.`,
  },
  el: {
    wakeWordDetected: (wakeWord) => `Εντοπίστηκε η λέξη ενεργοποίησης ${wakeWord}.`,
    modeSelection:
      'Τώρα μπορείτε να δοκιμάσετε τις φωνητικές δυνατότητες με πέντε διαφορετικούς τρόπους. Επιλέξτε τοπική συνομιλία τεχνητής νοημοσύνης, που λειτουργεί εξ ολοκλήρου σε αυτή τη συσκευή· πλήρη συνομιλία τεχνητής νοημοσύνης, που χρησιμοποιεί το απομακρυσμένο μοντέλο Gemini· ή δοκιμάστε την αναγνώριση ομιλίας και τη σύνθεση ομιλίας χωριστά ή μαζί.',
    cloningChoices: (hasClonedVoices) =>
      hasClonedVoices
        ? 'Μπορείτε να κλωνοποιήσετε μια νέα φωνή, να επιλέξετε μία από τις κλωνοποιημένες φωνές σας ή να διαλέξετε μια ενσωματωμένη φωνή.'
        : 'Μπορείτε να κλωνοποιήσετε μια νέα φωνή ή να διαλέξετε μια ενσωματωμένη φωνή.',
    introduction: (voice) => [
      `Γεια σας. Με λένε ${voice}. Σε αυτή την εφαρμογή χρησιμοποιώ την κλωνοποιημένη φωνή μου για να δείξω τις δυνατότητες του φωνητικού μας βοηθού τεχνητής νοημοσύνης.`,
      'Θα σας καθοδηγήσω βήμα βήμα σε αυτή την επίδειξη.',
      'Πρώτα, επιλέξτε τη φωνή που θέλετε να χρησιμοποιήσετε.',
    ],
    selectedVoice: (voice) => `Επιλέξατε τη φωνή ${voice}.`,
    speakerVerificationSetup:
      'Το επόμενο βήμα είναι η ρύθμιση της επαλήθευσης ταυτότητας ομιλητή. Μπορείτε να δημιουργήσετε ένα νέο φωνητικό αποτύπωμα, να χρησιμοποιήσετε ένα αποθηκευμένο ή να παραλείψετε αυτό το βήμα.',
    speakerVerificationSkipped: 'Η επαλήθευση ομιλητή παραλείφθηκε.',
    speakerVerificationReady: 'Η επαλήθευση ομιλητή είναι έτοιμη!',
    sayWakeWord: (wakeWords) => `Τώρα πείτε τη λέξη ενεργοποίησης ${wakeWords} για να συνεχίσετε.`,
    cloneCreated: (voice) => `Γεια σας! Αυτή είναι η νέα κλωνοποιημένη φωνή μου, ${voice}.`,
  },
};

export function narrationFor(language: AppLanguage): NarrationCopy {
  return NARRATION[language];
}
