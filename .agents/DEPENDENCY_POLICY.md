# DEPENDENCY POLICY — Job-Finder

See the global policy at ~/.gemini/config/DEPENDENCY_POLICY.md for full rules.

## Quick Reference

### For Web (npm)
- Weekly downloads ≥ 100,000
- Bundle size < 10KB gzipped for utilities
- License: MIT, Apache-2.0, or BSD only
- Run `npm outdated` before adding anything new
- Check Bundlephobia: https://bundlephobia.com/package/<name>

### For Flutter (pub.dev)
- pub.dev score ≥ 90
- Dart 3 + null safety required
- License: MIT, Apache-2.0, or BSD only
- Run `flutter pub outdated` before adding anything new

### Banned (Web)
- moment.js → use date-fns
- lodash full → use lodash-es with tree shaking
- react-router → Next.js App Router handles this

### Banned (Flutter)
- provider/ChangeNotifier → use Riverpod
- bloc/flutter_bloc → use Riverpod StateNotifier
- dio/http → use Supabase client or NetworkResilience wrapper
- get/getx/get_it → use Riverpod Ref
