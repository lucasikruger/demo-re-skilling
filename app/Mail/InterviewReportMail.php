<?php

namespace App\Mail;

use App\Models\InterviewSession;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

class InterviewReportMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(public InterviewSession $session)
    {
    }

    public function build(): self
    {
        $mail = $this->subject('Informe demo: '.$this->session->participant_name)
            ->view('emails.report', [
                'session' => $this->session,
                'report' => $this->session->report,
            ]);

        $disk = Storage::disk(config('filesystems.default'));

        if ($this->session->report?->pdf_path && $disk->exists($this->session->report->pdf_path)) {
            $mail->attachData(
                $disk->get($this->session->report->pdf_path),
                'informe-'.$this->session->public_id.'.pdf',
                ['mime' => 'application/pdf']
            );
        }

        return $mail;
    }
}
