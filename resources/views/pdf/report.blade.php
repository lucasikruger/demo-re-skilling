<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Informe final</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 12px; color: #192126; }
        h1, h2, h3 { margin-bottom: 6px; }
        h1 { font-size: 24px; }
        h2 { font-size: 16px; margin-top: 18px; }
        .muted { color: #54606b; }
        .block { margin-bottom: 14px; padding: 12px; border: 1px solid #d8dee4; border-radius: 8px; }
        .section-title { font-weight: bold; margin-bottom: 6px; }
        ul { padding-left: 18px; }
    </style>
</head>
<body>
    <h1>Informe final</h1>
    <p class="muted">Participante: {{ $session->participant_name }}</p>
    <p class="muted">Sesion: {{ $session->public_id }}</p>

    <div class="block">
        <div class="section-title">Resumen ejecutivo</div>
        <div>{{ $report->executive_summary }}</div>
    </div>

    @foreach(($report->sections ?? []) as $section)
        <div class="block">
            <div class="section-title">{{ $section['title'] ?? 'Seccion' }}</div>
            <div>{{ $section['body'] ?? '' }}</div>
        </div>
    @endforeach

</body>
</html>
