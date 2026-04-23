<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('interview_sessions', function (Blueprint $table) {
            $table->string('participant_email')->nullable()->after('participant_name');
        });
    }

    public function down(): void
    {
        Schema::table('interview_sessions', function (Blueprint $table) {
            $table->dropColumn('participant_email');
        });
    }
};
