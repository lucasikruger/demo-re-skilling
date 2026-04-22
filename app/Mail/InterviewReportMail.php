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

        if ($this->session->report?->pdf_path && Storage::disk('local')->exists($this->session->report->pdf_path)) {
            $mail->attach(Storage::disk('local')->path($this->session->report->pdf_path), [
                'as' => 'informe-'.$this->session->public_id.'.pdf',
                'mime' => 'application/pdf',
            ]);
        }

        return $mail;
    }
}
