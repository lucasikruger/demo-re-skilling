import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from './api';

const emptyTextForm = { title: '', body_text: '' };
const MAX_RECORDING_SECONDS = 180;

function useRecorder() {
    const [isRecording, setIsRecording] = useState(false);
    const [blob, setBlob] = useState(null);
    const [error, setError] = useState(null);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const startedAtRef = useRef(null);
    const [duration, setDuration] = useState(0);
    const [limitSeconds, setLimitSeconds] = useState(MAX_RECORDING_SECONDS);
    const liveTimerRef = useRef(null);
    const autoStopTimeoutRef = useRef(null);

    useEffect(() => {
        return () => {
            if (liveTimerRef.current) {
                clearInterval(liveTimerRef.current);
            }
            if (autoStopTimeoutRef.current) {
                clearTimeout(autoStopTimeoutRef.current);
            }
        };
    }, []);

    const start = async (maxSeconds = MAX_RECORDING_SECONDS) => {
        try {
            setError(null);
            setBlob(null);
            setDuration(0);
            setLimitSeconds(maxSeconds);

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                setError('Tu navegador no soporta la grabacion de audio. Intenta con un navegador mas reciente o desde una computadora de escritorio.');
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            const mimeType = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/mp4',
                'audio/ogg;codecs=opus',
            ].find(t => MediaRecorder.isTypeSupported(t)) ?? '';

            const recorder = mimeType
                ? new MediaRecorder(stream, { mimeType })
                : new MediaRecorder(stream);
            chunksRef.current = [];
            startedAtRef.current = Date.now();
            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };
            recorder.onstop = () => {
                if (liveTimerRef.current) {
                    clearInterval(liveTimerRef.current);
                    liveTimerRef.current = null;
                }
                if (autoStopTimeoutRef.current) {
                    clearTimeout(autoStopTimeoutRef.current);
                    autoStopTimeoutRef.current = null;
                }
                const actualType = recorder.mimeType || mimeType || 'audio/webm';
                const nextBlob = new Blob(chunksRef.current, { type: actualType });
                setBlob(nextBlob);
                setDuration(Math.min(maxSeconds, Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))));
                stream.getTracks().forEach((track) => track.stop());
            };
            recorder.start();
            liveTimerRef.current = setInterval(() => {
                if (!startedAtRef.current) {
                    return;
                }

                const elapsed = Math.min(
                    maxSeconds,
                    Math.floor((Date.now() - startedAtRef.current) / 1000)
                );
                setDuration(elapsed);
            }, 250);
            autoStopTimeoutRef.current = setTimeout(() => {
                setError(`Llegaste al maximo de ${formatDuration(maxSeconds)}. Detuvimos la grabacion automaticamente.`);
                recorder.stop();
                setIsRecording(false);
            }, maxSeconds * 1000);
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
        } catch (err) {
            const msg = err?.name === 'NotAllowedError'
                ? 'Permiso de microfono denegado. Habilitalo desde la configuracion del navegador.'
                : err?.name === 'NotFoundError'
                    ? 'No se encontro ningun microfono en este dispositivo.'
                    : `No se pudo iniciar la grabacion: ${err?.message || 'error desconocido'}`;
            setError(msg);
        }
    };

    const stop = () => {
        if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const reset = () => {
        if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        if (liveTimerRef.current) {
            clearInterval(liveTimerRef.current);
            liveTimerRef.current = null;
        }
        if (autoStopTimeoutRef.current) {
            clearTimeout(autoStopTimeoutRef.current);
            autoStopTimeoutRef.current = null;
        }
        setBlob(null);
        setDuration(0);
        setLimitSeconds(MAX_RECORDING_SECONDS);
        setError(null);
        setIsRecording(false);
    };

    return { isRecording, blob, duration, limitSeconds, error, start, stop, reset };
}

function App() {
    const [dashboard, setDashboard] = useState({ questions: [], globalContextItems: [], customDemos: [], sessions: [] });
    const [selectedSession, setSelectedSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [participantName, setParticipantName] = useState('');
    const [currentScreen, setCurrentScreen] = useState('intro');
    const [selectedMode, setSelectedMode] = useState(null);
    const [questionDraft, setQuestionDraft] = useState('');
    const [globalTextForm, setGlobalTextForm] = useState(emptyTextForm);
    const [sessionTextForm, setSessionTextForm] = useState(emptyTextForm);
    const [editingQuestions, setEditingQuestions] = useState({});
    const [reportsPassword, setReportsPassword] = useState('');
    const [reportsCatalog, setReportsCatalog] = useState([]);
    const [reportEmail, setReportEmail] = useState('');
    const [uploadingAnswerId, setUploadingAnswerId] = useState(null);
    const [selectedCustomDemo, setSelectedCustomDemo] = useState(null);
    const [customEditor, setCustomEditor] = useState({ name: '', general_context_materials: [], questions: [] });
    const [adminUnlocked, setAdminUnlocked] = useState(false);
    const [autoFinalizing, setAutoFinalizing] = useState(false);
    const [reportReturnTarget, setReportReturnTarget] = useState('mode');
    const [captureEmail, setCaptureEmail] = useState('');
    const recorder = useRecorder();

    const selectedAnswer = useMemo(() => {
        if (!selectedSession?.answers) {
            return null;
        }

        return [...selectedSession.answers].sort((a, b) => a.sort_order - b.sort_order).find(
            (answer) => ['pending', 'failed'].includes(answer.status)
        ) ?? null;
    }, [selectedSession]);

    const processedAnswers = useMemo(
        () => selectedSession?.answers?.filter((answer) => answer.status === 'processed').length ?? 0,
        [selectedSession]
    );

    const totalAnswers = selectedSession?.answers?.length ?? dashboard.questions.length;
    const stepNumber = selectedAnswer?.sort_order ?? Math.min(processedAnswers + 1, totalAnswers || 1);

    const loadDashboard = async () => {
        const { data } = await api.get('/dashboard');
        setDashboard(data);
    };

    const loadSession = async (publicId) => {
        const { data } = await api.get(`/sessions/${publicId}`);
        setSelectedSession(data);
    };

    useEffect(() => {
        (async () => {
            try {
                await loadDashboard();
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    useEffect(() => {
        if (!selectedSession?.session?.public_id) {
            return undefined;
        }

        if (!['recording', 'queued_for_report', 'processing_report'].includes(selectedSession.session.status)) {
            return undefined;
        }

        const poll = setInterval(async () => {
            await loadSession(selectedSession.session.public_id);
        }, 2000);

        return () => clearInterval(poll);
    }, [selectedSession]);

    useEffect(() => {
        if (!selectedSession?.session) {
            return;
        }

        if (currentScreen === 'interview' && selectedSession.session.status === 'queued_for_report') {
            setCurrentScreen('processing');
        }

        if (
            ['processing', 'interview'].includes(currentScreen) &&
            selectedSession.session.status === 'report_ready' &&
            selectedSession.report
        ) {
            setReportReturnTarget('mode');
            setCurrentScreen('report');
        }
    }, [selectedSession, currentScreen]);

    // Auto-finalize only when the user is NOT on the interview screen
    // (they left before completing). On the interview screen, the email form handles it.
    useEffect(() => {
        if (!selectedSession?.session || selectedSession.session.status !== 'recording' || autoFinalizing) {
            return;
        }

        if (currentScreen === 'interview') {
            return;
        }

        const answers = selectedSession.answers ?? [];

        if (!answers.length) {
            return;
        }

        const allProcessed = answers.every((answer) => answer.status === 'processed');

        if (!allProcessed) {
            return;
        }

        setAutoFinalizing(true);
        finalizeSession().finally(() => setAutoFinalizing(false));
    }, [selectedSession?.session?.status, selectedSession?.answers, autoFinalizing, currentScreen]);

    useEffect(() => {
        if (!message) return undefined;
        const t = setTimeout(() => setMessage(''), 4000);
        return () => clearTimeout(t);
    }, [message]);

    const runTask = async (task, successMessage = '', options = {}) => {
        const { blockUi = true } = options;

        try {
            if (blockUi) {
                setBusy(true);
            }
            setMessage('');
            await task();
            if (successMessage) {
                setMessage(successMessage);
            }
        } catch (error) {
            setMessage(error.response?.data?.message || 'Ocurrio un error durante la operacion.');
        } finally {
            if (blockUi) {
                setBusy(false);
            }
        }
    };

    const createSession = async (mode) => {
        if (!participantName.trim()) {
            setMessage('Necesitamos el nombre para preparar el test.');
            return;
        }

        await runTask(async () => {
            recorder.reset();
            const { data } = await api.post('/sessions', { participant_name: participantName });
            setSelectedSession(data);
            setSelectedMode(mode);
            setReportReturnTarget('mode');
            setCurrentScreen('interview');
            await loadDashboard();
        }, 'Sesion creada.');
    };

    const openTestLibrary = () => {
        setSelectedMode('tests');
        setCurrentScreen('tests');
    };

    const openAdminTests = async () => {
        if (!adminUnlocked) {
            setMessage('Primero habilita Debug mode desde el menu principal.');
            return;
        }

        setSelectedMode('tests-admin');
        setCurrentScreen('tests-admin');
    };

    const startNewCustomDemo = () => {
        setSelectedCustomDemo(null);
        setCustomEditor({
            name: '',
            prosody_materials: [],
            general_context_materials: [],
            questions: [
                {
                    prompt: 'Contame brevemente por que pediste esta evaluacion.',
                    time_limit_seconds: 180,
                    analysis_materials: [
                        {
                            type: 'text',
                            title: 'Motivacion para solicitar evaluacion',
                            body_text: 'Las personas suelen solicitar evaluaciones de comunicacion cuando perciben que sus mensajes no llegan con claridad o que el impacto de su discurso no refleja su intencion. La autoevaluacion inicial es un predictor confiable de apertura al cambio. (Kluger & DeNisi, 1996)',
                        },
                    ],
                },
                {
                    prompt: 'Que situaciones te generan mas tension o incomodidad en el trabajo?',
                    time_limit_seconds: 180,
                    analysis_materials: [
                        {
                            type: 'text',
                            title: 'Tension situacional y comunicacion',
                            body_text: 'El estres situacional activa el eje hipotalamico-hipofisario-adrenal, elevando el cortisol y reduciendo la fluidez verbal, la precision lexica y el control prosodico. Identificar los disparadores permite disenar intervenciones especificas. (McEwen, 2007)',
                        },
                    ],
                },
                {
                    prompt: 'Cuando sentis presion, como notas que cambia tu forma de hablar?',
                    time_limit_seconds: 180,
                    analysis_materials: [
                        {
                            type: 'text',
                            title: 'Indicadores vocales de presion',
                            body_text: 'Bajo presion aguda, el habla tiende a acelerarse, el tono sube y aparecen mas disfluencias (pausas llenas, repeticiones). Estos patrones son medibles con analisis acustico y constituyen biometricos validos del estado emocional. (Laukka et al., 2008)',
                        },
                    ],
                },
                {
                    prompt: 'Que te gustaria que este informe ayude a entender mejor?',
                    time_limit_seconds: 180,
                    analysis_materials: [
                        {
                            type: 'text',
                            title: 'Expectativas sobre el feedback de comunicacion',
                            body_text: 'Cuando el destinatario define de antemano que espera del informe, aumenta la relevancia percibida y la probabilidad de aplicar las recomendaciones. El feedback orientado a metas tiene mayor efecto que el feedback generico. (Locke & Latham, 2002)',
                        },
                    ],
                },
                {
                    prompt: 'Hay algun contexto personal o profesional que deba tenerse en cuenta?',
                    time_limit_seconds: 180,
                    analysis_materials: [
                        {
                            type: 'text',
                            title: 'Contexto personal como variable moderadora',
                            body_text: 'Factores como el rol dentro del equipo, la antiguedad en la organizacion o circunstancias personales recientes moderan la interpretacion de los patrones prosodicos observados. El contexto mejora la precision del diagnostico. (Lazarus & Folkman, 1984)',
                        },
                    ],
                },
            ],
        });
        setCurrentScreen('custom-editor');
    };

    const ensureAdminAccess = async () => {
        if (adminUnlocked) {
            return reportsPassword;
        }

        const code = reportsPassword.trim();

        if (!code) {
            setMessage('Ingresa el codigo de administracion en el cuadro Debug mode.');
            return null;
        }

        try {
            await api.post('/reports/access', { password: code });
            setReportsPassword(code);
            setAdminUnlocked(true);
            return code;
        } catch {
            setMessage('El codigo de administracion es incorrecto.');
            return null;
        }
    };

    const editCustomDemo = async (publicId) => {
        if (!adminUnlocked) {
            setMessage('Primero habilita Debug mode desde el menu principal.');
            return;
        }

        await runTask(async () => {
            const { data } = await api.get(`/custom-demos/${publicId}`);
            setSelectedCustomDemo(data);
            setCustomEditor({
                name: data.name,
                prosody_materials: data.definition?.prosody_materials ?? [],
                general_context_materials: data.definition?.general_context_materials ?? [],
                questions: (data.definition?.questions ?? []).map((question) => ({
                    prompt: question.prompt ?? '',
                    time_limit_seconds: question.time_limit_seconds ?? 180,
                    analysis_materials: question.analysis_materials ?? [],
                })),
            });
            setCurrentScreen('custom-editor');
        });
    };

    const saveCustomDemo = async () => {
        if (!adminUnlocked) {
            setMessage('Primero habilita Debug mode desde el menu principal.');
            return;
        }

        if (!customEditor.name.trim()) {
            setMessage('El test custom necesita nombre.');
            return;
        }

        await runTask(async () => {
            const formData = new FormData();
            const serialized = {
                prosody_materials: serializeMaterials(customEditor.prosody_materials ?? [], formData, 'prosody'),
                general_context_materials: serializeMaterials(customEditor.general_context_materials ?? [], formData, 'general'),
                questions: customEditor.questions.map((question, questionIndex) => ({
                    prompt: question.prompt,
                    time_limit_seconds: question.time_limit_seconds,
                    analysis_materials: serializeMaterials(question.analysis_materials ?? [], formData, `q${questionIndex}_analysis`),
                })),
            };

            formData.append('name', customEditor.name);
            formData.append('definition', JSON.stringify(serialized));

            const endpoint = selectedCustomDemo
                ? `/custom-demos/${selectedCustomDemo.public_id}/update`
                : '/custom-demos';

            const { data } = await api.post(endpoint, formData);
            setSelectedCustomDemo(data);
            setCurrentScreen('tests-admin');
            await loadDashboard();
        }, selectedCustomDemo ? 'Demo custom actualizada.' : 'Demo custom creada.');
    };

    const launchCustomDemo = async (template) => {
        if (!participantName.trim()) {
            setMessage('Necesitamos el nombre para preparar el test.');
            return;
        }

        await runTask(async () => {
            recorder.reset();
            const { data } = await api.post(`/custom-demos/${template.public_id}/sessions`, {
                participant_name: participantName,
            });
            setSelectedSession(data);
            setSelectedMode('custom');
            setReportReturnTarget('mode');
            setCurrentScreen('interview');
            await loadDashboard();
        }, 'Test custom creado.');
    };

    const deleteCustomDemo = async (publicId) => {
        if (!adminUnlocked) {
            setMessage('Primero habilita Debug mode desde el menu principal.');
            return;
        }

        await runTask(async () => {
            await api.delete(`/custom-demos/${publicId}`);
            await loadDashboard();
        }, 'Test eliminado.');
    };

    const startNewCustomDemoProtected = async () => {
        if (!adminUnlocked) {
            setMessage('Primero habilita Debug mode desde el menu principal.');
            return;
        }

        startNewCustomDemo();
    };

    const syncSessionQuestions = async () => {
        if (!selectedSession?.session?.public_id) {
            return;
        }

        const { data } = await api.post(`/sessions/${selectedSession.session.public_id}/sync-questions`);
        setSelectedSession(data);
    };

    const addQuestion = async () => {
        if (!questionDraft.trim()) {
            return;
        }

        await runTask(async () => {
            await api.post('/questions', { prompt: questionDraft });
            setQuestionDraft('');
            await loadDashboard();
        }, 'Pregunta agregada.');
    };

    const saveQuestion = async (question) => {
        await runTask(async () => {
            await api.put(`/questions/${question.id}`, question);
            await loadDashboard();
        }, 'Pregunta actualizada.');
    };

    const removeQuestion = async (questionId) => {
        await runTask(async () => {
            await api.delete(`/questions/${questionId}`);
            await loadDashboard();
        }, 'Pregunta eliminada.');
    };

    const uploadTextContext = async (scope) => {
        const form = scope === 'global' ? globalTextForm : sessionTextForm;
        if (!form.title.trim() || !form.body_text.trim()) {
            return;
        }

        await runTask(async () => {
            if (scope === 'global') {
                await api.post('/context/global/text', form);
                setGlobalTextForm(emptyTextForm);
                await loadDashboard();
            } else if (selectedSession) {
                await api.post(`/sessions/${selectedSession.session.public_id}/context/text`, form);
                setSessionTextForm(emptyTextForm);
                await loadSession(selectedSession.session.public_id);
            }
        }, 'Contexto cargado.');
    };

    const uploadDocument = async (scope, file, title) => {
        if (!file || !title.trim()) {
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('document', file);

        await runTask(async () => {
            if (scope === 'global') {
                await api.post('/context/global/document', formData);
                await loadDashboard();
            } else if (selectedSession) {
                await api.post(`/sessions/${selectedSession.session.public_id}/context/document`, formData);
                await loadSession(selectedSession.session.public_id);
            }
        }, 'Documento enviado para indexacion.');
    };

    const uploadAnswer = async () => {
        if (!selectedSession || !selectedAnswer || !recorder.blob) {
            return;
        }

        const blobType = recorder.blob.type || 'audio/webm';
        const ext = blobType.includes('mp4') ? 'mp4' : blobType.includes('ogg') ? 'ogg' : 'webm';
        const file = new File([recorder.blob], `respuesta-${selectedAnswer.question_id ?? selectedAnswer.public_id}.${ext}`, {
            type: blobType,
        });
        const formData = new FormData();
        formData.append('audio', file);
        formData.append('duration_seconds', recorder.duration);

        await runTask(async () => {
            setUploadingAnswerId(selectedAnswer.id);
            const endpoint = selectedAnswer.question_id
                ? `/sessions/${selectedSession.session.public_id}/answers/${selectedAnswer.question_id}/audio`
                : `/sessions/${selectedSession.session.public_id}/answers/by-answer/${selectedAnswer.public_id}/audio`;

            await api.post(endpoint, formData);
            setSelectedSession((current) => {
                if (!current) {
                    return current;
                }

                return {
                    ...current,
                    answers: current.answers.map((answer) =>
                        answer.id === selectedAnswer.id
                            ? { ...answer, status: 'processing' }
                            : answer
                    ),
                };
            });
            recorder.reset();
            await loadSession(selectedSession.session.public_id);
        }, 'Audio enviado a procesamiento.', { blockUi: false });
        setUploadingAnswerId(null);
    };

    const finalizeSession = async (email = '') => {
        if (!selectedSession) {
            return;
        }

        return runTask(async () => {
            await api.post(`/sessions/${selectedSession.session.public_id}/finalize`, { email: email || '' });
            await loadSession(selectedSession.session.public_id);
        }, email ? 'Informe en cola. Te enviamos el resultado por email.' : 'Informe en cola.');
    };

    const unlockReports = async () => {
        if (!adminUnlocked) {
            setMessage('Primero habilita Debug mode desde el menu principal.');
            return;
        }

        await runTask(async () => {
            const { data } = await api.post('/reports/access', { password: reportsPassword });
            setReportsCatalog(data.sessions);
            setReportReturnTarget('mode');
            setCurrentScreen('reports');
        }, 'Informes desbloqueados.');
    };

    const unlockAdminTools = async () => {
        const code = await ensureAdminAccess();

        if (!code) {
            return;
        }

        setMessage('Modo debug habilitado.');
    };

    const openExistingReport = async (publicId) => {
        await runTask(async () => {
            const { data } = await api.get(`/sessions/${publicId}`);
            setSelectedSession(data);
            setReportReturnTarget('reports');
            setCurrentScreen('report');
        });
    };

    const deleteContext = async (contextItemId) => {
        await runTask(async () => {
            await api.delete(`/context/${contextItemId}`);
            await loadDashboard();
            if (selectedSession) {
                await loadSession(selectedSession.session.public_id);
            }
        }, 'Contexto eliminado.');
    };

    const sendReportEmail = async () => {
        if (!selectedSession?.session?.public_id || !reportEmail.trim()) {
            return;
        }

        await runTask(async () => {
            await api.post(`/sessions/${selectedSession.session.public_id}/report/email`, {
                email: reportEmail,
            });
        }, 'Informe enviado por email.');
    };

    const goHome = () => {
        if (selectedSession?.session?.public_id && !['report_ready', 'interrupted'].includes(selectedSession.session.status)) {
            api.post(`/sessions/${selectedSession.session.public_id}/interrupt`).catch(() => {});
        }
        loadDashboard().catch(() => {});
        setCurrentScreen('mode');
        setSelectedSession(null);
        setSelectedMode(null);
        setReportsCatalog([]);
        setReportEmail('');
        setSelectedCustomDemo(null);
        recorder.reset();
    };

    const goToIntro = () => {
        if (selectedSession?.session?.public_id && !['report_ready', 'interrupted'].includes(selectedSession.session.status)) {
            api.post(`/sessions/${selectedSession.session.public_id}/interrupt`).catch(() => {});
        }
        setCurrentScreen('intro');
        setAdminUnlocked(false);
        setReportsPassword('');
        setParticipantName('');
        setSelectedSession(null);
        setSelectedMode(null);
        setReportsCatalog([]);
        setReportEmail('');
        setSelectedCustomDemo(null);
        recorder.reset();
    };

    const goBack = () => {
        if (currentScreen === 'custom-editor') {
            setCurrentScreen('tests-admin');
            return;
        }

        if (['tests', 'tests-admin', 'reports'].includes(currentScreen)) {
            setCurrentScreen('mode');
            return;
        }

        if (currentScreen === 'report') {
            setCurrentScreen(reportReturnTarget);
            return;
        }
    };

    if (loading) {
        return <div className="loading-screen">Preparando pipeline de análisis de voz...</div>;
    }

    return (
        <div className="experience-shell">
            <BackgroundGlow />
            <header className="app-header">
                <div>
                    <p className="eyebrow">Demo para re-skilling.ai</p>
                    <h1>Pipeline de análisis de voz</h1>
                </div>
                <div className="header-actions">
                    {currentScreen === 'mode' ? (
                        <button className="ghost" onClick={goToIntro}>Cambiar nombre</button>
                    ) : null}
                    {['interview', 'processing'].includes(currentScreen) ? (
                        <button className="ghost" onClick={goHome}>Cancelar</button>
                    ) : null}
                </div>
            </header>

            {currentScreen === 'intro' ? (
                <IntroScreen
                    participantName={participantName}
                    setParticipantName={setParticipantName}
                    onContinue={() => setCurrentScreen('mode')}
                />
            ) : null}

            {currentScreen === 'mode' ? (
                <ModeScreen
                    participantName={participantName}
                    reportsPassword={reportsPassword}
                    setReportsPassword={setReportsPassword}
                    onTestMe={openTestLibrary}
                    onEditTests={openAdminTests}
                    onUnlockReports={unlockReports}
                    onUnlockAdminTools={unlockAdminTools}
                    adminUnlocked={adminUnlocked}
                />
            ) : null}

            {currentScreen === 'tests' ? (
                <TestLibraryScreen
                    participantName={participantName}
                    customDemos={dashboard.customDemos ?? []}
                    onDefault={() => createSession('default')}
                    onLaunch={launchCustomDemo}
                    onBack={goBack}
                    adminMode={false}
                />
            ) : null}

            {currentScreen === 'tests-admin' ? (
                <TestLibraryScreen
                    participantName={participantName}
                    customDemos={dashboard.customDemos ?? []}
                    onCreateNew={startNewCustomDemoProtected}
                    onEdit={editCustomDemo}
                    onLaunch={launchCustomDemo}
                    onDelete={deleteCustomDemo}
                    onBack={goBack}
                    adminMode
                />
            ) : null}

            {currentScreen === 'custom-editor' ? (
                <CustomEditorScreen
                    editor={customEditor}
                    setEditor={setCustomEditor}
                    selectedCustomDemo={selectedCustomDemo}
                    onSave={saveCustomDemo}
                    onBack={goBack}
                />
            ) : null}

            {currentScreen === 'interview' ? (
                <InterviewScreen
                    selectedSession={selectedSession}
                    selectedAnswer={selectedAnswer}
                    stepNumber={stepNumber}
                    totalAnswers={totalAnswers}
                    recorder={recorder}
                    processedAnswers={processedAnswers}
                    uploadingAnswerId={uploadingAnswerId}
                    onUploadAnswer={uploadAnswer}
                    onFinalize={finalizeSession}
                    captureEmail={captureEmail}
                    setCaptureEmail={setCaptureEmail}
                    debugEnabled={adminUnlocked}
                />
            ) : null}

            {currentScreen === 'processing' ? (
                <ProcessingScreen selectedSession={selectedSession} />
            ) : null}

            {currentScreen === 'reports' ? (
                <ReportsCatalog sessions={reportsCatalog} onOpenReport={openExistingReport} onBack={goBack} />
            ) : null}

            {currentScreen === 'report' ? (
                <ReportStage
                    selectedSession={selectedSession}
                    reportEmail={reportEmail}
                    setReportEmail={setReportEmail}
                    onSendEmail={sendReportEmail}
                    onBack={goBack}
                    debugEnabled={adminUnlocked}
                />
            ) : null}

            {message ? <div className="toast">{message}</div> : null}
            {busy ? <div className="busy-overlay">Procesando...</div> : null}
        </div>
    );
}

function BackgroundGlow() {
    return (
        <div className="background-glow" aria-hidden="true">
            <div className="orb orb-a" />
            <div className="orb orb-b" />
            <div className="orb orb-c" />
        </div>
    );
}

function IntroScreen({ participantName, setParticipantName, onContinue }) {
    return (
        <section className="hero-stage slide-in">
            <div className="hero-copy">
                <p className="eyebrow">Paso inicial</p>
                <h2>Bienvenido al pipeline de análisis de voz</h2>
                <p>
                    Vamos a simular el flujo completo del producto: configuracion, entrevista por audio, analisis
                    prosodico, recuperacion de contexto e informe final con trazabilidad.
                </p>
            </div>
            <div className="hero-card">
                <label htmlFor="participant-name">Como te llamas?</label>
                <input
                    id="participant-name"
                    value={participantName}
                    onChange={(event) => setParticipantName(event.target.value)}
                    placeholder="Tu nombre"
                />
                <button onClick={onContinue}>Continuar</button>
            </div>
        </section>
    );
}

function ModeScreen({
    participantName,
    reportsPassword,
    setReportsPassword,
    onTestMe,
    onEditTests,
    onUnlockReports,
    onUnlockAdminTools,
    adminUnlocked,
}) {
    return (
        <section className="menu-stage slide-in">
            <div className="section-heading">
                <p className="eyebrow">Paso 2</p>
                <h2>Que queres hacer?</h2>
                <p>{participantName ? `Participante actual: ${participantName}` : 'Podes cambiar el nombre volviendo al paso inicial.'}</p>
            </div>

            <div className="mode-grid">
                <button className="mode-card" onClick={onTestMe}>
                    <span className="mode-badge">Testearme</span>
                    <strong>Elegir test</strong>
                    <p>Primero vas a ver el test default y debajo la lista de tests creados para ejecutar.</p>
                </button>

                <button className="mode-card alt" onClick={onEditTests}>
                    <span className="mode-badge">Editar</span>
                    <strong>Editar tests</strong>
                    <p>
                        {adminUnlocked
                            ? 'Modo protegido habilitado para crear, editar o quitar tests custom.'
                            : 'Necesita Debug mode habilitado desde el cuadro inferior.'}
                    </p>
                </button>

                <button className="mode-card reports" onClick={onUnlockReports}>
                    <span className="mode-badge">Informes</span>
                    <strong>Ver informes</strong>
                    <p>
                        {adminUnlocked
                            ? 'Accede a los informes guardados.'
                            : 'Necesita Debug mode habilitado desde el cuadro inferior.'}
                    </p>
                </button>
            </div>

            <div className="panel deluxe-panel debug-panel">
                <p className="eyebrow">Debug mode</p>
                {adminUnlocked ? (
                    <>
                        <h3>Acceso protegido</h3>
                        <div className="debug-active-badge">
                            <span className="debug-dot" />
                            Activado
                        </div>
                    </>
                ) : (
                    <>
                        <h3>Acceso protegido</h3>
                        <p>La misma clave habilita editar tests y abrir informes previos.</p>
                        <div className="inline-form">
                            <input
                                type="password"
                                value={reportsPassword}
                                onChange={(event) => setReportsPassword(event.target.value)}
                                placeholder="Codigo de acceso"
                            />
                            <button className="ghost" onClick={onUnlockAdminTools}>Desbloquear</button>
                        </div>
                    </>
                )}
            </div>
        </section>
    );
}

function TestLibraryScreen({ participantName, customDemos, onDefault, onCreateNew, onEdit, onLaunch, onDelete, onBack, adminMode = false }) {
    return (
        <section className="menu-stage slide-in">
            <div className="section-heading">
                <p className="eyebrow">{adminMode ? 'Editar tests' : 'Testearme'}</p>
                <h2>{adminMode ? 'Administrar tests' : 'Elegi como testearte'}</h2>
                <p>
                    {participantName
                        ? `Participante actual: ${participantName}.`
                        : 'Primero define el nombre identificador.'}
                </p>
            </div>

            {adminMode ? (
                <div className="panel deluxe-panel custom-library-toolbar">
                    <div className="inline-form">
                        <button onClick={onCreateNew}>Crear nuevo test</button>
                    </div>
                </div>
            ) : null}

            <div className="reports-grid">
                {!adminMode ? (
                    <div className="report-card report-card-accent">
                        <span className="mode-badge">Default</span>
                        <strong>Usar configuracion predefinida</strong>
                        <p>El camino recomendado para mostrar el producto sin tocar configuraciones.</p>
                        <div className="row-actions">
                            <button onClick={onDefault}>Iniciar test</button>
                        </div>
                    </div>
                ) : null}
                {customDemos.map((demo) => (
                    <div className="report-card" key={demo.public_id}>
                        <span className="mode-badge">Test</span>
                        <strong>{demo.name}</strong>
                        <p>{formatDateTime(demo.updated_at || demo.created_at)}</p>
                        <div className="row-actions">
                            {adminMode ? (
                                <>
                                    <button className="ghost" onClick={() => onEdit(demo.public_id)}>Editar</button>
                                    <button className="danger" onClick={() => onDelete(demo.public_id)}>Borrar</button>
                                </>
                            ) : (
                                <button onClick={() => onLaunch(demo)}>Iniciar test</button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            <div className="footer-actions">
                <button className="ghost" onClick={onBack}>Volver atras</button>
            </div>
        </section>
    );
}

function CustomEditorScreen({ editor, setEditor, selectedCustomDemo, onSave, onBack }) {
    const updateQuestion = (index, updater) => {
        setEditor((current) => ({
            ...current,
            questions: current.questions.map((question, questionIndex) =>
                questionIndex === index ? updater(question) : question
            ),
        }));
    };

    const addQuestion = () => {
        setEditor((current) => ({
            ...current,
            questions: [...current.questions, { prompt: '', time_limit_seconds: 180, analysis_materials: [] }],
        }));
    };

    const removeQuestion = (index) => {
        setEditor((current) => ({
            ...current,
            questions: current.questions.filter((_, questionIndex) => questionIndex !== index),
        }));
    };

    const addProsodyMaterial = (type) => {
        setEditor((current) => ({
            ...current,
            prosody_materials: [...(current.prosody_materials ?? []), createMaterial(type)],
        }));
    };

    const updateProsodyMaterial = (materialIndex, patch) => {
        setEditor((current) => ({
            ...current,
            prosody_materials: (current.prosody_materials ?? []).map((material, currentIndex) =>
                currentIndex === materialIndex ? { ...material, ...patch } : material
            ),
        }));
    };

    const removeProsodyMaterial = (materialIndex) => {
        setEditor((current) => ({
            ...current,
            prosody_materials: (current.prosody_materials ?? []).filter((_, currentIndex) => currentIndex !== materialIndex),
        }));
    };

    const addGeneralMaterial = (type) => {
        setEditor((current) => ({
            ...current,
            general_context_materials: [
                ...(current.general_context_materials ?? []),
                createMaterial(type),
            ],
        }));
    };

    const updateGeneralMaterial = (materialIndex, patch) => {
        setEditor((current) => ({
            ...current,
            general_context_materials: (current.general_context_materials ?? []).map((material, currentIndex) =>
                currentIndex === materialIndex ? { ...material, ...patch } : material
            ),
        }));
    };

    const removeGeneralMaterial = (materialIndex) => {
        setEditor((current) => ({
            ...current,
            general_context_materials: (current.general_context_materials ?? []).filter((_, currentIndex) => currentIndex !== materialIndex),
        }));
    };

    const addQuestionMaterial = (questionIndex, bucket, type) => {
        updateQuestion(questionIndex, (question) => ({
            ...question,
            [bucket]: [
                ...(question[bucket] ?? []),
                createMaterial(type),
            ],
        }));
    };

    const updateQuestionMaterial = (questionIndex, bucket, materialIndex, patch) => {
        updateQuestion(questionIndex, (question) => ({
            ...question,
            [bucket]: (question[bucket] ?? []).map((material, currentIndex) =>
                currentIndex === materialIndex ? { ...material, ...patch } : material
            ),
        }));
    };

    const removeQuestionMaterial = (questionIndex, bucket, materialIndex) => {
        updateQuestion(questionIndex, (question) => ({
            ...question,
            [bucket]: (question[bucket] ?? []).filter((_, currentIndex) => currentIndex !== materialIndex),
        }));
    };

    return (
        <section className="customize-grid slide-in">
            <div className="setup-column">
                <div className="panel deluxe-panel">
                    <p className="eyebrow">{selectedCustomDemo ? 'Editar custom' : 'Nueva custom'}</p>
                    <h3>{selectedCustomDemo ? 'Editar test existente' : 'Crear test custom'}</h3>
                    <div className="stack compact">
                        <input
                            value={editor.name}
                            onChange={(event) => setEditor((current) => ({ ...current, name: event.target.value }))}
                            placeholder="Nombre del test"
                        />
                    </div>
                </div>
                <div className="panel deluxe-panel">
                    <p className="eyebrow">Preguntas</p>
                    <h3>Configura tiempo y material por pregunta</h3>
                    <div className="stack">
                        {editor.questions.map((question, questionIndex) => (
                            <div className="editable-row custom-question-card" key={`question-${questionIndex}`}>
                                <textarea
                                    value={question.prompt}
                                    onChange={(event) =>
                                        updateQuestion(questionIndex, (current) => ({ ...current, prompt: event.target.value }))
                                    }
                                    placeholder={`Pregunta ${questionIndex + 1}`}
                                />
                                <label className="slider-label">
                                    Tiempo maximo: {Math.round((question.time_limit_seconds ?? 180) / 60)} min
                                </label>
                                <input
                                    type="range"
                                    min="60"
                                    max="300"
                                    step="30"
                                    value={question.time_limit_seconds ?? 180}
                                    onChange={(event) =>
                                        updateQuestion(questionIndex, (current) => ({
                                            ...current,
                                            time_limit_seconds: Number(event.target.value),
                                        }))
                                    }
                                />
                                <div className="row-actions">
                                    <button className="danger" onClick={() => removeQuestion(questionIndex)}>Quitar pregunta</button>
                                </div>
                                <MaterialGroupEditor
                                    title="Material de referencia"
                                    materials={question.analysis_materials ?? []}
                                    onAddText={() => addQuestionMaterial(questionIndex, 'analysis_materials', 'text')}
                                    onAddFile={() => addQuestionMaterial(questionIndex, 'analysis_materials', 'file')}
                                    onUpdate={(materialIndex, patch) => updateQuestionMaterial(questionIndex, 'analysis_materials', materialIndex, patch)}
                                    onRemove={(materialIndex) => removeQuestionMaterial(questionIndex, 'analysis_materials', materialIndex)}
                                />
                            </div>
                        ))}
                    </div>
                    <div className="row-actions">
                        <button className="ghost" onClick={addQuestion}>Agregar pregunta</button>
                        <button onClick={onSave}>Guardar</button>
                    </div>
                </div>
            </div>

            <div className="setup-column">
                <div className="panel deluxe-panel">
                    <p className="eyebrow">Análisis prosódico</p>
                    <h3>Contexto general de prosodia</h3>
                    <p className="muted">Este material se incluye en el análisis de cada audio grabado en el test.</p>
                    <MaterialGroupEditor
                        title="Material para análisis prosódico"
                        materials={editor.prosody_materials ?? []}
                        onAddText={() => addProsodyMaterial('text')}
                        onAddFile={() => addProsodyMaterial('file')}
                        onUpdate={(materialIndex, patch) => updateProsodyMaterial(materialIndex, patch)}
                        onRemove={(materialIndex) => removeProsodyMaterial(materialIndex)}
                    />
                </div>
                <div className="panel deluxe-panel">
                    <p className="eyebrow">Contexto</p>
                    <h3>Material para el informe final</h3>
                    <p className="muted">Se usa al consolidar todas las respuestas y armar el informe final.</p>
                    <MaterialGroupEditor
                        title="Contexto del test"
                        materials={editor.general_context_materials ?? []}
                        onAddText={() => addGeneralMaterial('text')}
                        onAddFile={() => addGeneralMaterial('file')}
                        onUpdate={(materialIndex, patch) => updateGeneralMaterial(materialIndex, patch)}
                        onRemove={(materialIndex) => removeGeneralMaterial(materialIndex)}
                    />
                </div>
            </div>
            <div className="footer-actions">
                <button className="ghost" onClick={onBack}>Volver atras</button>
            </div>
        </section>
    );
}

function MaterialGroupEditor({ title, materials, onAddText, onAddFile, onUpdate, onRemove }) {
    return (
        <div className="stack compact">
            <div className="material-group-header">
                <strong>{title}</strong>
                <div className="row-actions">
                    <button className="ghost" type="button" onClick={onAddText}>Agregar texto</button>
                    <button className="ghost" type="button" onClick={onAddFile}>Agregar archivo</button>
                </div>
            </div>
            {materials.length ? materials.map((material, materialIndex) => (
                <div className="material-editor-card" key={`${title}-${materialIndex}`}>
                    <input
                        value={material.title ?? ''}
                        onChange={(event) => onUpdate(materialIndex, { title: event.target.value })}
                        placeholder="Titulo del material"
                    />
                    {material.type === 'text' ? (
                        <>
                            <textarea
                                value={material.body_text ?? ''}
                                onChange={(event) => onUpdate(materialIndex, { body_text: event.target.value })}
                                placeholder="Texto de apoyo"
                            />
                            <button className="danger" type="button" onClick={() => onRemove(materialIndex)}>Quitar texto</button>
                        </>
                    ) : (
                        <MaterialFilePicker
                            material={material}
                            onSelect={(file) => onUpdate(materialIndex, { file })}
                            onRemove={() => onRemove(materialIndex)}
                        />
                    )}
                </div>
            )) : <p className="muted">Todavia no cargaste materiales.</p>}
        </div>
    );
}

function MaterialFilePicker({ material, onSelect, onRemove }) {
    return (
        <div className="material-picker">
            <label className="ghost material-picker-button">
                <input
                    type="file"
                    accept=".pdf,.txt,.md"
                    hidden
                    onChange={(event) => onSelect(event.target.files?.[0] || null)}
                />
                Elegir archivo
            </label>
            {material.file || material.original_filename ? (
                <div className="file-chip">
                    <span className="file-chip-icon">{resolveFileBadge(material)}</span>
                    <span>{material.file?.name ?? material.original_filename ?? 'Archivo'}</span>
                    <button type="button" className="file-chip-remove" onClick={onRemove}>×</button>
                </div>
            ) : null}
        </div>
    );
}

function InterviewScreen({
    selectedSession,
    selectedAnswer,
    stepNumber,
    totalAnswers,
    recorder,
    processedAnswers,
    uploadingAnswerId,
    onUploadAnswer,
    onFinalize,
    captureEmail,
    setCaptureEmail,
    debugEnabled,
}) {
    if (!selectedSession) {
        return null;
    }

    const allProcessed = selectedSession.answers.every((answer) => answer.status === 'processed');
    const allSubmitted = selectedSession.answers.every((answer) => answer.status !== 'pending');
    const activeAnswer = selectedAnswer;
    const revealedStep = allSubmitted ? totalAnswers : stepNumber;
    const visibleAnswers = [...selectedSession.answers]
        .sort((a, b) => a.sort_order - b.sort_order)
        .filter((answer) => answer.sort_order <= revealedStep);
    const debugAnswers = visibleAnswers.filter((answer) => answer.status !== 'pending');

    return (
        <section className="interview-stage slide-in">
            <div className="interview-grid">
                <article className="panel recorder-stage">
                    <div className="pulse-ring" />
                    {activeAnswer ? (
                        <>
                            <p className="eyebrow">Pregunta</p>
                            <h3>{activeAnswer.prompt_snapshot ?? activeAnswer.question?.prompt ?? 'Pregunta'}</h3>
                            <p className="eyebrow" style={{ marginTop: '1.25rem' }}>Grabacion</p>
                            {recorder.error ? <p className="feedback">{recorder.error}</p> : null}
                            <div className="row-actions">
                                {!recorder.isRecording && !recorder.blob ? (
                                    <button onClick={() => recorder.start(activeAnswer?.time_limit_seconds ?? MAX_RECORDING_SECONDS)}>
                                        Grabar respuesta
                                    </button>
                                ) : null}
                                {recorder.isRecording ? (
                                    <button className="danger" onClick={recorder.stop}>
                                        Detener
                                    </button>
                                ) : null}
                                {!recorder.isRecording && recorder.blob ? (
                                    <>
                                        <button className="ghost" onClick={recorder.reset}>
                                            Reiniciar
                                        </button>
                                        <button onClick={onUploadAnswer}>
                                            {uploadingAnswerId === activeAnswer.id ? 'Enviando...' : 'Enviar audio'}
                                        </button>
                                    </>
                                ) : (
                                    null
                                )}
                            </div>
                            <p className="recorder-counter">
                                {recorder.isRecording ? 'Grabando' : recorder.blob ? 'Grabacion lista' : 'Tiempo disponible'} ·{' '}
                                {formatDuration(recorder.duration)} / {formatDuration(activeAnswer?.time_limit_seconds ?? MAX_RECORDING_SECONDS)}
                            </p>
                            {recorder.blob ? (
                                <div className="stack">
                                    <audio controls src={URL.createObjectURL(recorder.blob)} />
                                    <p className="muted">Duracion aproximada: {recorder.duration}s</p>
                                </div>
                            ) : (
                                <p className="muted">La grabacion se vincula solo a esta pregunta.</p>
                            )}
                        </>
                    ) : (
                        <div className="completion-card">
                            <p className="eyebrow">Siguiente etapa</p>
                            <h3>{allProcessed ? 'Preparando informe final' : 'Procesando la ultima respuesta'}</h3>
                            <p className="muted">
                                {allProcessed
                                    ? 'Ya no hace falta grabar nada mas. Estamos pasando automaticamente al informe.'
                                    : 'Ya no mostramos el grabador porque las respuestas ya fueron enviadas. Espera mientras termina el procesamiento.'}
                            </p>
                            <div className="loader-bar">
                                <div className="loader-bar-fill" />
                            </div>
                        </div>
                    )}
                </article>

                <article className="panel answers-stage">
                    <p className="eyebrow">Progreso</p>
                    <h3>Preguntas 1 a {totalAnswers}</h3>
                    <div className="step-pill-grid">
                        {Array.from({ length: totalAnswers }, (_, index) => {
                            const answer = selectedSession.answers.find((item) => item.sort_order === index + 1);
                            const isDone = answer?.status === 'processed';
                            const isFailed = answer?.status === 'failed';
                            const isActive = ['queued', 'processing'].includes(answer?.status) || uploadingAnswerId === answer?.id;
                            const isCurrent = !isDone && !isActive && !isFailed && answer?.status === 'pending' && (index + 1) === stepNumber;

                            let pillClass = 'step-pill';
                            if (isDone) pillClass += ' done';
                            else if (isFailed) pillClass += ' failed';
                            else if (isActive) pillClass += ' active';
                            else if (isCurrent) pillClass += ' current';

                            return (
                                <div className={pillClass} key={`step-pill-${index + 1}`}>
                                    <span>{index + 1}</span>
                                </div>
                            );
                        })}
                    </div>
                    <p className="muted">Las preguntas se van habilitando y procesando a medida que avanzas.</p>
                    {allProcessed ? (
                        <div className="finalize-form">
                            <p className="eyebrow">Generar informe</p>
                            <p className="finalize-hint">
                                Ingresa un email para recibir el informe cuando este listo, incluso si salis antes de que termine.
                                Si no, podes verlo desde debug mode.
                            </p>
                            <div className="inline-form">
                                <input
                                    type="email"
                                    placeholder="tu@email.com (opcional)"
                                    value={captureEmail}
                                    onChange={(e) => setCaptureEmail(e.target.value)}
                                />
                                <button onClick={() => onFinalize(captureEmail)}>
                                    Generar informe
                                </button>
                            </div>
                        </div>
                    ) : null}
                    {debugEnabled && debugAnswers.length ? (
                        <DebugAccordion label="Open debug" subtitle="Trazas internas por respuesta">
                            <div className="stack compact answer-expander-list">
                                {debugAnswers.map((answer) => (
                                    <AnswerTraceExpander key={answer.public_id ?? answer.id} answer={answer} />
                                ))}
                            </div>
                        </DebugAccordion>
                    ) : null}
                </article>
            </div>
        </section>
    );
}

function ProcessingScreen({ selectedSession }) {
    return (
        <section className="processing-stage slide-in">
            <div className="panel deluxe-panel">
                <p className="eyebrow">Procesando</p>
                <h2>Armando el informe final</h2>
                <p>{selectedSession?.session?.processing_stage || 'Consolidando transcripciones, prosodia y contexto recuperado.'}</p>
                <div className="loader-bar">
                    <div className="loader-bar-fill" />
                </div>
            </div>
        </section>
    );
}

function ReportsCatalog({ sessions, onOpenReport, onBack }) {
    return (
        <section className="reports-stage slide-in">
            <div className="section-heading">
                <p className="eyebrow">Biblioteca de informes</p>
                <h2>Revisar tests anteriores</h2>
                <p>Los informes guardados muestran el resultado final y la traza del proceso.</p>
            </div>
            <div className="reports-grid">
                {sessions.map((session) => {
                    const isCancelled = session.status === 'interrupted';

                    if (isCancelled) {
                        return (
                            <div className="report-card report-card-cancelled" key={session.public_id}>
                                <span className="mode-badge badge-cancelled">Cancelado</span>
                                <strong>{session.participant_name}</strong>
                                <p>{formatDateTime(session.completed_at || session.created_at)}</p>
                            </div>
                        );
                    }

                    return (
                        <button className="report-card" key={session.public_id} onClick={() => onOpenReport(session.public_id)}>
                            <span className="mode-badge">Informe</span>
                            <strong>{session.participant_name}</strong>
                            <p>{formatDateTime(session.completed_at || session.created_at)}</p>
                        </button>
                    );
                })}
            </div>
            <div className="footer-actions">
                <button className="ghost" onClick={onBack}>Volver atras</button>
            </div>
        </section>
    );
}

function ReportStage({ selectedSession, reportEmail, setReportEmail, onSendEmail, onBack, debugEnabled }) {
    if (!selectedSession?.report) {
        return null;
    }

    return (
        <section className="report-stage slide-in">
            <div className="report-top-nav">
                <button className="ghost" onClick={onBack}>Volver atras</button>
            </div>
            <div className="report-toolbar">
                <a className="report-download" href={`/reportes/${selectedSession.session.public_id}/pdf`} target="_blank" rel="noreferrer">
                    Descargar informe PDF
                </a>
                <div className="email-share">
                    <input
                        value={reportEmail}
                        onChange={(event) => setReportEmail(event.target.value)}
                        placeholder="Enviar a email@dominio.com"
                    />
                    <button onClick={onSendEmail}>Enviar por email</button>
                </div>
            </div>
            <ReportView session={selectedSession.session} report={selectedSession.report} />
        </section>
    );
}

function ContextTextForm({ value, onChange, onSubmit }) {
    return (
        <div className="stack compact">
            <input
                value={value.title}
                onChange={(event) => onChange((current) => ({ ...current, title: event.target.value }))}
                placeholder="Titulo del contexto"
            />
            <textarea
                value={value.body_text}
                onChange={(event) => onChange((current) => ({ ...current, body_text: event.target.value }))}
                placeholder="Texto de apoyo para la recuperacion"
            />
            <button onClick={onSubmit}>Agregar texto</button>
        </div>
    );
}

function DocumentUploader({ onUpload }) {
    const [title, setTitle] = useState('');
    const [file, setFile] = useState(null);

    return (
        <div className="stack compact uploader">
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Titulo del documento" />
            <input type="file" accept=".pdf,.txt,.md" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            <button onClick={() => onUpload(file, title)}>Subir documento</button>
        </div>
    );
}

function ContextList({ items, onDelete }) {
    if (!items.length) {
        return <p className="muted">Sin contexto cargado todavia.</p>;
    }

    return (
        <div className="stack compact">
            {items.map((item) => (
                <div className="context-item" key={item.id}>
                    <div>
                        <strong>{item.title}</strong>
                        <p>{item.kind} · {item.ingestion_status}</p>
                    </div>
                    <button className="danger" onClick={() => onDelete(item.id)}>
                        Quitar
                    </button>
                </div>
            ))}
        </div>
    );
}

function ReportView({ session, report }) {
    return (
        <div className="report-grid-single">
            <article className="report-summary panel deluxe-panel">
                <p className="eyebrow">Resumen ejecutivo</p>
                <h2>{session.participant_name}</h2>
                <p className="muted">{formatDateTime(report.generated_at || session.completed_at || session.created_at)}</p>
                <p>{report.executive_summary}</p>
                <div className="stack compact">
                    {(report.sections || []).map((section, index) => (
                        <div className="report-section" key={index}>
                            <strong>{section.title}</strong>
                            <p>{section.body}</p>
                        </div>
                    ))}
                </div>
            </article>
        </div>
    );
}

function QuestionMaterials({ materials }) {
    if (!materials?.length) {
        return null;
    }

    return (
        <div className="question-materials">
            <p className="eyebrow">Archivos y textos usados</p>
            <div className="stack compact">
                {materials.map((material, index) => (
                    <div className="file-chip" key={`${material.title}-${index}`}>
                        <span className="file-chip-icon">{resolveFileBadge(material)}</span>
                        <span>{material.title || material.original_filename || 'Material de apoyo'}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function DebugAccordion({ label, subtitle, children }) {
    return (
        <details className="trace-expander debug-accordion">
            <summary>
                <span>{label}</span>
                <small>{subtitle}</small>
            </summary>
            <div className="trace-expander-body">
                {children}
            </div>
        </details>
    );
}

function AnswerTraceExpander({ answer, reportMode = false }) {
    const prompt = answer.prompt_snapshot || answer.question?.prompt || answer.question || 'Respuesta';
    const trace = answer.model_trace ?? {};
    const usedFiles = trace.used_files ?? answer.question_materials?.filter((item) => item.type === 'file') ?? [];
    const usedTexts = trace.used_texts ?? answer.question_materials?.filter((item) => item.type === 'text') ?? [];

    return (
        <details className="trace-expander">
            <summary>
                <span>Debug · {prompt}</span>
                <small>
                    {['processing', 'queued'].includes(answer.status) || ['processing', 'queued'].includes(trace.status)
                        ? 'Generando respuesta...'
                        : answer.status === 'processed' || trace.status === 'processed'
                            ? 'Respuesta lista'
                            : 'Pendiente'}
                </small>
            </summary>
            <div className="trace-expander-body">
                <div className="trace-meta-grid">
                    <div>
                        <strong>Archivos usados</strong>
                        <div className="stack compact">
                            {usedFiles.length ? usedFiles.map((file, index) => (
                                <div className="file-chip" key={`${file.title}-${index}`}>
                                    <span className="file-chip-icon">{resolveFileBadge(file)}</span>
                                    <span>{file.title || file.original_filename || 'Archivo'}</span>
                                </div>
                            )) : <p className="muted">Sin archivos.</p>}
                        </div>
                    </div>
                    <div>
                        <strong>Textos usados</strong>
                        <div className="stack compact">
                            {usedTexts.length ? usedTexts.map((text, index) => (
                                <div className="report-section" key={`${text.title}-${index}`}>
                                    <strong>{text.title || 'Texto'}</strong>
                                    <p>{text.body_text || text.content}</p>
                                </div>
                            )) : <p className="muted">Sin textos.</p>}
                        </div>
                    </div>
                </div>
                <div className="trace-output-slider">
                    <div className="trace-output-pane">
                        <strong>Respuesta del modelo</strong>
                        <pre>{JSON.stringify(trace.response ?? answer.prosody_payload ?? {}, null, 2)}</pre>
                    </div>
                    {!reportMode ? (
                        <div className="trace-output-pane">
                            <strong>Resumen visible</strong>
                            <p><span>Transcripcion:</span> {answer.transcript || 'Todavia no disponible.'}</p>
                            <p><span>Analisis prosodico:</span> {answer.prosody_summary || 'Todavia no disponible.'}</p>
                        </div>
                    ) : null}
                </div>
                <div className="trace-context-list">
                    <strong>Chunks recuperados para esta respuesta</strong>
                    {(answer.retrieved_context ?? []).length ? (
                        <div className="stack compact">
                            {(answer.retrieved_context ?? []).map((snippet, index) => (
                                <div className="snippet" key={`${snippet.title}-${index}`}>
                                    <strong>{snippet.title}</strong>
                                    <small>{snippet.scope} · source: {snippet.source} · score {snippet.score}</small>
                                    <p>{snippet.content}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="muted">Todavia no hay chunks recuperados para esta respuesta.</p>
                    )}
                </div>
                <p className="muted">{formatDateTime(answer.processed_at || trace.finished_at || trace.started_at)}</p>
            </div>
        </details>
    );
}

function createMaterial(type) {
    return type === 'text'
        ? { type: 'text', title: '', body_text: '' }
        : { type: 'file', title: '', file: null };
}

function serializeMaterials(materials, formData, prefix) {
    return materials.map((material, materialIndex) => {
        if (material.type === 'text') {
            return {
                type: 'text',
                title: material.title,
                body_text: material.body_text,
            };
        }

        if (material.file instanceof File) {
            const fileKey = `${prefix}_m${materialIndex}`;
            formData.append(`files[${fileKey}]`, material.file);

            return {
                type: 'file',
                title: material.title,
                file_key: fileKey,
            };
        }

        return {
            type: 'file',
            title: material.title,
            file_path: material.file_path,
            original_filename: material.original_filename,
            mime_type: material.mime_type,
        };
    });
}

function formatDuration(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');

    return `${minutes}:${seconds}`;
}

function formatDateTime(value) {
    if (!value) {
        return 'Sin fecha';
    }

    return new Date(value).toLocaleString('es-AR');
}

function resolveFileBadge(material) {
    const filename = material.file?.name || material.original_filename || '';
    return filename.toLowerCase().endsWith('.pdf') || material.mime_type === 'application/pdf' ? 'PDF' : 'TXT';
}

export default App;
