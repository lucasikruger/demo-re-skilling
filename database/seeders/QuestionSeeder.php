<?php

namespace Database\Seeders;

use App\Models\Question;
use Illuminate\Database\Seeder;

class QuestionSeeder extends Seeder
{
    public function run(): void
    {
        $questions = [
            'Contame brevemente por que pediste esta evaluacion.',
            'Que situaciones te generan mas tension o incomodidad en el trabajo?',
            'Cuando sentis presion, como notas que cambia tu forma de hablar?',
            'Que te gustaria que este informe ayude a entender mejor?',
            'Hay algun contexto personal o profesional que deba tenerse en cuenta?',
        ];

        foreach ($questions as $index => $prompt) {
            Question::updateOrCreate(
                ['position' => $index + 1],
                ['prompt' => $prompt, 'is_active' => true]
            );
        }
    }
}
